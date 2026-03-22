---
name: create-custom-adapter
description: 自治体ごとのカスタムスクレイピングアダプターを作成する手順
version: 1.0.0
---

# カスタムスクレイピングアダプター作成手順

## 概要

既存の汎用アダプター（kensakusystem, gijiroku_com, dbsearch, discussnet_ssp）では対応できない独自の会議録検索システムを持つ自治体向けに、カスタムアダプターを作成する手順。

## 引数

```
/create-custom-adapter {自治体名} {会議録検索URL}
```

例: `/create-custom-adapter 品川区 https://kaigiroku.city.shinagawa.tokyo.jp/...`

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

### Step 1: 対象サイトの調査

WebFetch で対象サイトにアクセスし、以下を調査する:

1. **一覧ページの URL パターン**: 検索パラメータ、ページネーション方式
2. **個別ドキュメントの URL パターン**: ドキュメント ID の形式、パラメータ
3. **発言の HTML 構造**: `<li>`, `<div>` 等のマークアップ、話者名のマーカー（◯, ●等）
4. **文字コード**: UTF-8 or Shift_JIS
5. **会議の種類**: 本会議（定例会・臨時会）、委員会

### Step 2: ディレクトリとファイル作成

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

### Step 3: shared.ts — 共通ユーティリティ

```typescript
// 必須の export:
export const BASE_ORIGIN = "https://...";  // サイトのオリジン
export function detectMeetingType(title: string): string { ... }  // plenary/committee/extraordinary
export async function fetchPage(url: string): Promise<string | null> { ... }  // fetch ラッパー
export function buildListUrl(...): string { ... }  // 一覧ページ URL 構築
export function buildDocumentUrl(...): string { ... }  // ドキュメントページ URL 構築
```

### Step 4: list.ts — 一覧取得

```typescript
// parseListPage(): HTML をパースしてドキュメント一覧を返す（テスト可能な純粋関数）
// fetchDocumentList(): 全ページを巡回して全件取得する（ネットワークアクセスあり）
```

ポイント:
- 発言データを含まないページ（名簿・議事日程など）はスキップする
- ページネーションに対応する
- Cabinet ID や検索パラメータの網羅が必要

### Step 5: detail.ts — 詳細取得

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

### Step 6: index.ts — ScraperAdapter 実装

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

### Step 7: テストを書く

テストコードの書き方ガイドライン（`.claude/rules/test-writing-guidelines.md`）を遵守する:

- ヘルパー関数を使わない
- 期待値はベタ書き
- parseListPage / parseSpeaker / classifyKind / parseStatements をテスト

```bash
# テスト実行
cd packages/scrapers && bun test src/adapters/custom/{dir}/
```

### Step 8: レジストリへの登録（自動）

`packages/scrapers/src/index.ts` が `adapters/custom/` 配下のディレクトリを自動走査して登録するため、**手動でのレジストリ登録は不要**。

アダプターのディレクトリに `export const adapter: ScraperAdapter = { ... }` を定義するだけで自動検出される。

### Step 9: 型チェック・テスト実行

```bash
# 型チェック（新規コードにエラーがないこと）
bun tsc --noEmit 2>&1 | grep {adapter-dir}

# テスト実行
cd packages/scrapers && bun test src/adapters/custom/{dir}/
```

### Step 10: コミット・プッシュ・PR

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
