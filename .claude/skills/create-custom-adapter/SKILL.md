---
name: create-custom-adapter
description: 自治体ごとのカスタムスクレイピングアダプターを作成する手順
version: 2.0.0
---

# カスタムスクレイピングアダプター作成手順

## 概要

既存の汎用アダプター（kensakusystem, gijiroku_com, dbsearch, discussnet_ssp）では対応できない独自の会議録検索システムを持つ自治体向けに、カスタムアダプターを作成する手順。

## 引数

```
/create-custom-adapter {docs/custom-scraping のファイル名}
```

例: `/create-custom-adapter mobara`（拡張子 `.md` は省略可）

引数がない場合はユーザーに確認する。

## アーキテクチャ

```
ScraperAdapter インターフェース (packages/scrapers/src/adapters/adapter.ts)
├── fetchList({ baseUrl, year }) → ListRecord[]
│   各 ListRecord は detailParams を持ち、detail フェーズにキュー経由で渡される
└── fetchDetail({ detailParams, municipalityId }) → MeetingData | null
    detailParams を使って議事録本文を取得し、MeetingData を返す

汎用ハンドラー (apps/scraper-worker/src/handlers/)
├── generic-list.ts   ← adapter.fetchList() を呼び detail メッセージをキューに投入
└── generic-detail.ts ← adapter.fetchDetail() を呼び DB に保存

※ 個別のハンドラーファイルは不要。ScraperAdapter を実装すれば汎用ハンドラーが処理する。
```

## 実行手順

### Step 1: 調査ドキュメントの読み込み

`docs/custom-scraping/{引数}.md` を読み、以下の情報を把握する:

- **サイト URL**: 会議録一覧のベース URL
- **分類**: PDF 公開、独自 HTML、CMS 等
- **URL 構造**: 一覧ページ、年度別ページ、個別ドキュメントのパターン
- **HTML 構造**: 一覧・詳細ページの DOM 構造、CSS セレクタ
- **発言者マーカー**: ◯, ●, ◆ 等の話者識別記号
- **会議種別**: 本会議（定例会・臨時会）、委員会の構成
- **文字コード**: UTF-8 or Shift_JIS
- **ページネーション**: 年度別ページ遷移、次ページリンク等

情報がない場合はスキップする

### Step 2: 自治体コードの特定

`packages/db/src/seeds/municipalities.csv` から自治体コードを取得する:

```bash
grep -i '{自治体名}' packages/db/src/seeds/municipalities.csv
```

### Step 3: ディレクトリとファイル作成

カスタムアダプターは以下のディレクトリ構造で作成する:

```
packages/scrapers/src/adapters/custom/{自治体コード}-{自治体名ローマ字}/
├── index.ts        # ScraperAdapter 実装（adapter export）
├── shared.ts       # 共通ユーティリティ（URL 構築、fetch、会議タイプ検出）
├── list.ts         # 一覧取得ロジック（HTML パース）
├── list.test.ts    # 一覧パースのテスト
├── detail.ts       # 詳細取得ロジック（発言パース）
└── detail.test.ts  # 発言パースのテスト
```

**命名規則**: `{6桁自治体コード}-{ローマ字名}` 例: `131091-shinagawa`

### Step 4: shared.ts — 共通ユーティリティ

調査ドキュメントの「URL 構造」セクションを元に URL 構築関数を実装する。

```typescript
// 必須の export:
export const BASE_ORIGIN = "https://...";  // 調査ドキュメントのサイト URL
export function detectMeetingType(title: string): string { ... }  // plenary/committee/extraordinary
export async function fetchPage(url: string): Promise<string | null> { ... }  // fetch ラッパー
export function buildListUrl(...): string { ... }  // 一覧ページ URL 構築
export function buildDocumentUrl(...): string { ... }  // ドキュメントページ URL 構築
```

### Step 5: list.ts — 一覧取得

調査ドキュメントの「URL 構造」「HTML 構造」セクションを元に実装する。

```typescript
// parseListPage(): HTML をパースしてドキュメント一覧を返す（テスト可能な純粋関数）
// fetchDocumentList(): 全ページを巡回して全件取得する（ネットワークアクセスあり）
```

ポイント:
- 発言データを含まないページ（名簿・議事日程など）はスキップする
- ページネーションに対応する
- Cabinet ID や検索パラメータの網羅が必要

### Step 6: detail.ts — 詳細取得

調査ドキュメントの「発言者マーカー」「HTML 構造」セクションを元に実装する。

```typescript
// parseSpeaker(): 発言テキストから話者名・役職・本文を抽出
// classifyKind(): 役職から発言種別を分類（remark/question/answer）
// parseStatements(): HTML から ParsedStatement[] を抽出
// fetchMeetingData(): ドキュメントから MeetingData を組み立て
```

**ParsedStatement の必須フィールド:**
```typescript
{
  kind: "remark" | "question" | "answer",
  speakerName: string | null,
  speakerRole: string | null,
  content: string,
  contentHash: string,        // SHA-256 of content
  startOffset: number,
  endOffset: number,
}
```

**kind の分類ルール:**
- `remark`: 議長・副議長・委員長の進行発言、マーカーなしの議事メモ
- `question`: 議員の質問
- `answer`: 行政側（区長・市長・部長・課長等）の答弁

**contentHash の生成:**
```typescript
import { createHash } from "node:crypto";
const contentHash = createHash("sha256").update(content).digest("hex");
```

### Step 7: index.ts — ScraperAdapter 実装

```typescript
import type { ScraperAdapter, ListRecord } from "../../adapter";

export const adapter: ScraperAdapter = {
  name: "{6桁自治体コード}",  // カスタムアダプターは自治体コードを使用する

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    // 一覧を取得し、各ドキュメントの detailParams を返す
    const documents = await fetchDocumentList(year);
    return documents.map((doc) => ({
      detailParams: { /* detail フェーズに渡すパラメータ */ },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    // detailParams をキャストして MeetingData を返す
    const params = detailParams as { ... };
    return fetchMeetingData(params, municipalityId);
  },
};
```

### Step 8: テストを書く

テストコードの書き方ガイドライン（`.claude/rules/test-writing-guidelines.md`）を遵守する:

- ヘルパー関数を使わない
- 期待値はベタ書き
- parseListPage / parseSpeaker / classifyKind / parseStatements をテスト

調査ドキュメントに記載されている HTML 構造・発言者マーカーの情報を活用してインラインのテストデータを構築する。

```bash
# テスト実行
cd packages/scrapers && bun test src/adapters/custom/{dir}/
```

### Step 9: レジストリへの登録（自動）

`packages/scrapers/src/index.ts` が `adapters/custom/` 配下のディレクトリを自動走査して登録するため、**手動でのレジストリ登録は不要**。

アダプターのディレクトリに `export const adapter: ScraperAdapter = { ... }` を定義するだけで自動検出される。

### Step 10: 型チェック・テスト実行

```bash
# 型チェック（新規コードにエラーがないこと）
bun tsc --noEmit 2>&1 | grep {adapter-dir}

# テスト実行
cd packages/scrapers && bun test src/adapters/custom/{dir}/
```

### Step 11: NDJSON 出力による動作確認

ユニットテストに加えて、実際にスクレイピングを実行して NDJSON 出力で動作確認する:

```bash
# scraper-worker ディレクトリから実行
cd apps/scraper-worker && bun run scrape:ndjson -- --target {自治体コード} --year {対象年}
```

例: `bun run scrape:ndjson -- --target 382051 --year 2025`

- 一覧取得 → 詳細取得の一連のフローが正常に動作することを確認する
- 出力された NDJSON の内容（会議名、発言者、発言内容など）が妥当か目視チェックする

### Step 12: コミット・プッシュ・PR

worktree ルールに従い、PR まで自動で作成する。

## 変更ファイル一覧

新規アダプター追加時に変更するファイル:

| ファイル | 変更内容 |
|---------|---------|
| `packages/scrapers/src/adapters/custom/{code}-{name}/` | スクレイパー実装（新規） |

**変更不要なファイル:**
- `packages/scrapers/src/index.ts` — アダプターは自動検出されるため登録不要
- `apps/scraper-worker/src/handlers/` — 個別ハンドラー不要
- `apps/scraper-worker/src/utils/types.ts` — 個別メッセージ型不要
- `apps/scraper-worker/src/utils/handle-message.ts` — 個別ルーティング不要

## 既存カスタムアダプターの参考

- `packages/scrapers/src/adapters/custom/131091-shinagawa/` — 品川区（kaigiroku.city.shinagawa.tokyo.jp）
