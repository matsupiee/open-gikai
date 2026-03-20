# PDF議事録スクレイピング戦略

## Context

全国約1,800自治体のうち、既存3システム（DiscussNet SSP / DB-Search / kensakusystem）でカバーできるのは688自治体。残り約1,100自治体の多くはPDFで議事録を公開している。まずはCSVに既にURLがある111自治体のうちPDFリンクを持つものから対応を開始し、段階的にカバレッジを拡大する。

---

## Phase 1: PDF自治体の特定と分類

**対象**: CSVにURLがあるがssp/dbsr/kensakusystem以外の111自治体

### やること
1. 111自治体のURLを手動/半自動でブラウザ確認し、PDFリンクの有無を分類
2. `pdf_sources` テーブルを新設し、PDF公開ページのURLとメタ情報を管理

### `pdf_sources` スキーマ (`packages/db/src/schema/pdf-sources.ts`)
```
pdf_sources:
  id: text (cuid2, PK)
  created_at: timestamp
  municipality_id: text (FK → municipalities)
  page_url: text          -- PDFリンクが掲載されたCMSページのURL
  pdf_link_selector: text -- PDF <a>タグを見つけるCSSセレクタ（デフォルト: 'a[href$=".pdf"]'）
  date_hint: text         -- 日付抽出方法のヒント（'filename' | 'link_text' | 'parent_element'）
  page_type: text         -- 'gijiroku_list' | 'gikai_dayori' | 'cms_archive' | 'single_page'
  discovery_status: text  -- 'candidate' | 'verified' | 'no_data' | 'blocked'
  notes: text
```

### 自治体の `system_type` 更新
- `system_types.ts` の `SystemType` union に `"pdf"` を追加
- `SYSTEM_TYPES_SEED` に `{ name: "pdf", description: "PDF直接公開" }` を追加
- 該当自治体の `system_type_id` を `pdf` に更新

---

## Phase 2: PDF抽出サービス（VPS）

### アーキテクチャ
VPS上にPython HTTPサービスをデプロイ。scraper-workerからHTTP経由で呼び出す。

### 技術スタック
- **Python + FastAPI** (or Flask)
- **pdfplumber**: テキストレイヤーPDF用（日本語対応良好）
- **pytesseract + poppler-utils**: スキャンPDF用（OCR）
- systemdまたはDocker Composeで常駐

### API設計
```
POST /extract
  Body: { "url": "<presigned R2 URL>" }  or  multipart PDF upload
  Response: {
    "text": "抽出されたテキスト全文",
    "pages": 12,
    "has_text_layer": true,
    "ocr_used": false
  }
```

### デプロイ先
既存VPSまたは安価なVPS（ConoHa, さくら等）。常駐サービスとして運用。

---

## Phase 3: scraper-worker PDF アダプター

### メッセージフロー（3フェーズ）

| フェーズ | メッセージタイプ | 処理内容 |
|---------|----------------|---------|
| 1. Crawl | `pdf:crawl` | CMSページをfetch → PDFリンク抽出 → 各PDFに `pdf:download` をenqueue |
| 2. Download | `pdf:download` | PDF fetchしてR2に保存 → meetingsにINSERT → `pdf:extract` をenqueue |
| 3. Extract | `pdf:extract` | VPSの抽出サービスを呼び出し → テキスト取得 → 発言パース → statements保存 |

### 新規ファイル構成
```
apps/scraper-worker/src/system-types/pdf/
  ├── _shared.ts              -- 共通ユーティリティ
  ├── crawl/
  │   ├── scraper.ts          -- CMSページからPDF URLを抽出
  │   └── handler.ts          -- pdf:crawl メッセージ処理
  ├── download/
  │   └── handler.ts          -- PDF取得 → R2保存 → meeting作成
  └── extract/
      ├── parser.ts           -- ルールベース発言パーサー
      └── handler.ts          -- 抽出サービス呼び出し → statements保存
```

### 変更が必要な既存ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/src/schema/system-types.ts` | `SystemType` に `"pdf"` 追加、SEED追加 |
| `packages/db/src/schema/index.ts` | `pdf_sources` エクスポート追加 |
| `apps/scraper-worker/src/utils/types.ts` | `pdf:crawl`, `pdf:download`, `pdf:extract` メッセージ型追加、`Env` に `R2_BUCKET` と `PDF_EXTRACTOR_URL` 追加 |
| `apps/scraper-worker/src/utils/handle-message.ts` | `case "pdf":` ルーティング追加 |
| `apps/scraper-worker/src/handlers/dispatch-job.ts` | `case "pdf":` ディスパッチ追加（pdf_sourcesをクエリ → pdf:crawl enqueue） |
| `apps/scraper-worker/wrangler.toml` | R2バケットバインディング追加、`PDF_EXTRACTOR_URL` 環境変数追加 |

### dispatch-job の pdf ケース
```typescript
case "pdf": {
  // pdf_sources から verified な行を取得
  // 各 source に対して pdf:crawl メッセージをキューに投入
}
```

---

## Phase 4: ルールベース発言パーサー

### パース戦略
PDF議事録の発言者マーカーパターン（優先度順）:

1. `○議長（山田太郎）` — 最も一般的
2. `◯３番（佐藤花子）` — 全角丸
3. `【議長 山田太郎】` — 角括弧パターン
4. `議長（山田太郎君）` — 丸なし、敬称付き
5. 行頭に役職名 + 氏名

### 実装方針
- 既存の `dbsearch/detail/scraper.ts` の `parseSpeakerFromTitle` / `classifyKind` ロジックを参考に共通化
- `ParsedStatement[]` を返す → 既存の `applyStatementsToMeeting` → `buildChunksForMeeting` パイプラインに合流
- パースできなかったPDFは `meetings.status = 'parse_failed'` としてスキップ（後日対応）

### externalId の生成
`pdf_{municipality_code}_{sha256(pdfUrl).slice(0,12)}` — URL単位で重複防止

---

## Phase 5: R2ストレージ

### バケット設定
- バケット名: `open-gikai-pdfs`
- キーパターン: `pdfs/{municipality_code}/{YYYY}/{filename}.pdf`

### wrangler.toml 追加
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "open-gikai-pdfs"
```

---

## 実装順序

| ステップ | 作業内容 | 主なファイル |
|---------|---------|-------------|
| 1 | `pdf_sources` スキーマ作成 + マイグレーション生成 | `packages/db/src/schema/pdf-sources.ts` |
| 2 | `SystemType` に `"pdf"` 追加 | `packages/db/src/schema/system-types.ts` |
| 3 | メッセージ型定義 + Env型更新 | `apps/scraper-worker/src/utils/types.ts` |
| 4 | R2バケット設定 | `apps/scraper-worker/wrangler.toml` |
| 5 | `pdf:crawl` ハンドラー実装 | `apps/scraper-worker/src/system-types/pdf/crawl/` |
| 6 | `pdf:download` ハンドラー実装 | `apps/scraper-worker/src/system-types/pdf/download/` |
| 7 | ルールベース発言パーサー実装 | `apps/scraper-worker/src/system-types/pdf/extract/parser.ts` |
| 8 | `pdf:extract` ハンドラー実装 | `apps/scraper-worker/src/system-types/pdf/extract/handler.ts` |
| 9 | `dispatch-job.ts` / `handle-message.ts` にルーティング追加 | 既存ファイル |
| 10 | Python抽出サービス構築・デプロイ | `services/pdf-extractor/` (新規) |
| 11 | 111自治体の手動調査 → pdf_sources にデータ投入 | DB seed / admin UI |
| 12 | E2Eテスト（5-10自治体で動作確認） | — |

---

## 検証方法

1. **スキーマ**: `drizzle-kit generate` でマイグレーション生成 → `drizzle-kit migrate` で適用確認
2. **抽出サービス**: 実際のPDF議事録でテキスト抽出の品質を確認（テキストレイヤー有/無の両方）
3. **crawlハンドラー**: 既知のPDF公開ページに対してPDFリンク抽出が正しく動作するか確認
4. **発言パーサー**: 複数自治体のPDFテキストに対して `ParsedStatement[]` が正しく生成されるか確認
5. **E2E**: admin UIからジョブ作成 → pdf:crawl → pdf:download → R2保存 → pdf:extract → statements/chunks保存の全フロー動作確認

---

## 将来の拡張（今回のスコープ外）

- URL無し995自治体の自動クローラーによる候補発見
- LLMフォールバックパーサーの追加
- OCR品質の低いPDFに対する再処理パイプライン
- admin UIにPDF自治体管理画面を追加

---

_作成日：2026年3月20日　バージョン：v1.0_
