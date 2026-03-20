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
VPS上にNode.js抽出サービスをデプロイ。scraper-workerからHTTP経由で呼び出す。

### 技術スタック
- **Node.js + `@opendataloader/pdf`** ([GitHub](https://github.com/opendataloader-project/opendataloader-pdf))
  - Java製PDFパーサーのNode.jsラッパー（npm: `@opendataloader/pdf`）
  - PDF → Markdown / JSON（構造化）/ テキスト形式で出力可能
  - テーブル・見出し・リスト・段落を構造レベルで認識
  - JSON出力にはバウンディングボックス・要素タイプ（heading, paragraph, table等）が含まれる
- **Java 11+**: `@opendataloader/pdf` の実行に必要（内部で `java -jar` を呼び出す）
- **Express or Hono**: HTTP API層
- systemdまたはDocker Composeで常駐

#### なぜ opendataloader-pdf を採用するか
- **TypeScriptエコシステムに統一**: Python + pdfplumber 構成だとPython環境の管理が必要になるが、Node.jsで完結できる
- **構造化出力**: JSON形式で要素タイプ（heading, paragraph, table, list）を区別して返せるため、Phase 4の発言パーサーの精度が向上する
- **テーブル認識**: 議事録に含まれる出席者一覧等のテーブルを構造的に抽出可能

#### 制約事項
- Java 11+ のインストールが必要（VPSにJRE/JDKを入れる）
- 各 `convert()` 呼び出しでJVMプロセスが起動するため、複数ファイルはバッチ処理が推奨
- **出力はファイル書き出し**: インメモリ返却ではないため、一時ディレクトリに書き出して読み取る必要がある
- **OCR（スキャンPDF）**: hybrid mode が必要で、別途Pythonサーバー（`opendataloader-pdf-hybrid`）が必要。テキストレイヤーありのPDFが大半のためPhase 2ではOCR非対応とし、将来の拡張で対応する

### API設計
```
POST /extract
  Body: { "url": "<presigned R2 URL>" }  or  multipart PDF upload
  Response: {
    "elements": [
      { "type": "heading", "content": "令和6年第1回定例会", "level": 1, "page": 1 },
      { "type": "paragraph", "content": "○議長（山田太郎）...", "page": 2 },
      { "type": "table", "content": "出席者一覧...", "page": 1 }
    ],
    "text": "抽出されたテキスト全文",
    "pages": 12,
    "has_text_layer": true
  }
```

### 内部実装イメージ
```typescript
import { convert } from '@opendataloader/pdf';
import { readFile } from 'fs/promises';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

async function extractPdf(pdfPath: string) {
  const outputDir = await mkdtemp(join(tmpdir(), 'pdf-extract-'));
  await convert([pdfPath], {
    outputDir,
    format: ['json', 'markdown'],
  });
  const jsonResult = await readFile(join(outputDir, '*.json'), 'utf-8');
  return JSON.parse(jsonResult);
}
```

### デプロイ先
既存VPSまたは安価なVPS（ConoHa, さくら等）。常駐サービスとして運用。
- 必要環境: Node.js 20+, Java 11+

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

opendataloader-pdf のJSON出力を活用し、要素タイプ（heading, paragraph, table）ごとに処理を分岐させる。これにより、テーブル（出席者一覧等）と本文（発言内容）を正確に区別できる。

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
| 10 | Node.js抽出サービス構築・デプロイ（@opendataloader/pdf + Java） | `services/pdf-extractor/` (新規) |
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

## PoC検証結果（五所川原市）

2026年3月20日に五所川原市（青森県）の令和7年第6回定例会会議録PDFで検証を実施。

### 検証対象
- URL: `https://www.city.goshogawara.lg.jp/gikai/files/0706kaigiroku.pdf`
- ファイルサイズ: 約1.9MB、155ページ

### @opendataloader/pdf の抽出結果
- **処理時間**: 5.6秒（全155ページ）
- **出力サイズ**: Markdown 152,477文字 / JSON 26,391バイト
- **テキストレイヤー**: あり（OCR不要）
- **日本語**: 問題なく抽出可能

### 発言パーサーの検出結果
- **発言マーカー検出数**: 413件
- **発言者数**: 16名
- **kind分類**: remark 222件 / answer 131件 / question 60件

### 発言者パターン
五所川原市の議事録では以下のパターンが確認された:
```
〇木村清一議長         → speakerName: "木村清一", role: "議長"
〇13番 高橋美奈議員    → speakerName: "高橋美奈", role: "議員"
〇佐々木孝昌市長       → speakerName: "佐々木孝昌", role: "市長"
〇川浪生郎総務部長     → speakerName: "川浪生郎", role: "総務部長"
```

### 判明した課題
1. **目次ページの誤検出**: `〇出席議員`、`〇欠席議員` が発言マーカーとして誤検出される → 目次ページ（ページ冒頭の議事日程セクション）をスキップするロジックが必要
2. **部署名付き役職の分割**: `川浪生郎総務部長` のように名前と部署名が連結されるため、正規表現の改善が必要（`〇{名前}{部署名}{役職}` パターンへの対応）
3. **PDF一括公開**: 五所川原市は1定例会分を1PDFに収めるため、PDFダウンロード単位 = meeting単位ではなく、PDF内で日付ごとに分割する処理が必要になる可能性がある

### 結論
**@opendataloader/pdf は十分に実用可能**。テキストレイヤーありのPDFについては高速かつ高品質にテキスト抽出でき、発言パーサーも基本的なパターンで8割以上の発言を正しく分類できた。上記課題はパーサーの正規表現調整で対応可能。

---

## 将来の拡張（今回のスコープ外）

- URL無し995自治体の自動クローラーによる候補発見
- LLMフォールバックパーサーの追加
- **スキャンPDF対応**: opendataloader-pdf の hybrid mode（`opendataloader-pdf-hybrid` Pythonサーバー）を導入し、OCRが必要なPDFに対応
- OCR品質の低いPDFに対する再処理パイプライン
- admin UIにPDF自治体管理画面を追加

---

_作成日：2026年3月20日　バージョン：v1.1（Phase 2: Python → @opendataloader/pdf に変更）_
