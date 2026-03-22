---
name: test-common-adapter
description: 汎用スクレイパーアダプターのパターン別統合テストを作成する手順
version: 1.0.0
---

# 汎用アダプター パターン別統合テスト作成手順

## 概要

汎用アダプター（dbsearch, kensakusystem, discussnet-ssp, gijiroku-com）は同一システムでも自治体ごとに HTML 構造が異なる。あるパターンに対応すると別パターンが壊れるリグレッションを防ぐため、複数パターンの実データフィクスチャを用意して統合テストを書く。

## 引数

```
/test-common-adapter {アダプター名}
```

例: `/test-common-adapter kensakusystem`

引数がない場合はユーザーに確認する。

## 対象アダプターとパターン一覧

| アダプター | ディレクトリ | パターン |
|---|---|---|
| dbsearch | `adapters/dbsearch/` | template-view, document-id, doc-one-frame |
| kensakusystem | `adapters/kensakusystem/` | sapphire, cgi, index-html |
| discussnet-ssp | `adapters/discussnet-ssp/` | saas, self-hosted, smart |
| gijiroku-com | `adapters/gijiroku-com/` | standard, self-hosted-voices, asp |

## 実行手順

### Step 1: アダプターのコード調査

対象アダプターの以下のファイルを読み、パターンの分岐ポイントを特定する:

```
packages/scrapers/src/adapters/{adapter-name}/
├── index.ts    # ScraperAdapter 実装（fetchList / fetchDetail）
├── list.ts     # 一覧取得ロジック（パターンごとの URL 構造・HTML パース分岐）
├── detail.ts   # 詳細取得ロジック（パターンごとの HTML 構造分岐）
└── shared.ts   # 共通ユーティリティ（存在する場合）
```

確認すべきポイント:
- **list.ts**: URL パターンの分岐（if/switch）、parseListHtml の正規表現パターン
- **detail.ts**: HTML 構造の分岐（frameset 判定、class 名による抽出バリアント）
- **list.ts / detail.ts のファイルコメント**: 「バリアント」や「形式」の記載

### Step 2: パターンごとの代表自治体を特定

`packages/db/src/seeds/municipalities.csv` から、各パターンの代表自治体を1つずつ選ぶ。

```bash
# dbsearch の自治体を検索
grep 'dbsr.jp' packages/db/src/seeds/municipalities.csv | head -20

# kensakusystem の自治体を検索
grep 'kensakusystem.jp' packages/db/src/seeds/municipalities.csv | head -20

# discussnet-ssp の自治体を検索
grep -E 'ssp\.kaigiroku\.net|/tenant/' packages/db/src/seeds/municipalities.csv | head -20

# gijiroku-com の自治体を検索
grep -E 'gijiroku\.com|/VOICES/' packages/db/src/seeds/municipalities.csv | head -20
```

選定基準:
- URL 構造がそのパターンの典型例であること
- サイトが稼働中であること（curl でアクセスできること）

### Step 3: フィクスチャディレクトリの作成

```bash
mkdir -p packages/scrapers/src/adapters/{adapter-name}/__fixtures__/patterns/{pattern-name}
```

各パターンのディレクトリ内に以下のファイルを配置する:

#### 共通（list フェーズ）

| ファイル | 内容 | 取得方法 |
|---------|------|---------|
| `top.html` | トップページ（CSRF トークン、エンドポイント ID、セッション Cookie） | GET |
| `search-result.html` | 検索結果ページ（レコード一覧） | POST（要セッション） |

#### detail フェーズ（パターンにより異なる）

**単一ページ型:**

| ファイル | 内容 |
|---------|------|
| `detail.html` | 議事録詳細ページ（タイトル・日付・発言一覧を含む） |

**フレームセット型（dbsearch doc-one-frame 等）:**

| ファイル | 内容 |
|---------|------|
| `frameset.html` | フレームセットページ（サブフレーム URL を含む） |
| `command.html` | コマンドサブフレーム（タイトル・日付） |
| `page.html` | ページサブフレーム（発言一覧） |

**JSON API 型（discussnet-ssp 等）:**

| ファイル | 内容 |
|---------|------|
| `tenant.js` | テナント ID を含む JavaScript |
| `councils.json` | 会議一覧 API レスポンス |
| `schedules.json` | スケジュール一覧 API レスポンス |
| `minute.json` | 議事録詳細 API レスポンス |

### Step 4: フィクスチャ HTML の取得

セッション管理が必要なサイトが多いため、**bun スクリプトで一括取得**する。

```typescript
// /tmp/fetch-{adapter}-fixtures.ts

import { writeFileSync, mkdirSync } from "node:fs";

const UA = "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

interface SiteConfig {
  pattern: string;       // パターン名（ディレクトリ名と一致）
  topUrl: string;        // サイトのトップURL
  year: number;          // 検索対象年
}

const sites: SiteConfig[] = [
  // Step 2 で特定した代表自治体を列挙
];

async function fetchPattern(config: SiteConfig) {
  const dir = `packages/scrapers/src/adapters/{adapter-name}/__fixtures__/patterns/${config.pattern}`;
  mkdirSync(dir, { recursive: true });

  // 1. GET top page → top.html として保存
  const topRes = await fetch(config.topUrl, {
    headers: { "User-Agent": UA },
  });
  const topHtml = await topRes.text();
  writeFileSync(`${dir}/top.html`, topHtml);

  // 2. Cookie / CSRF トークン / エンドポイント ID を抽出
  // （アダプター固有のロジックに合わせる）

  // 3. POST search → search-result.html として保存
  // （Cookie を含めてリクエスト）

  // 4. 検索結果から「本文」レコードの detail URL を抽出
  // 「名簿」「表紙」ではなく必ず「本文」を選ぶこと（発言データを含む）

  // 5. detail ページを取得して保存
  // フレームセットの場合はサブフレームも順に取得
}
```

**重要: セッション管理**
- Cookie を top page のレスポンスから取得し、後続リクエストに含める
- CSRF トークンがある場合は POST に含める
- フレームセットのセッション ID は top page → search → detail の一連のフローで取得する必要がある

### Step 5: フィクスチャの検証

取得した HTML が期待通りのパターンを含んでいることを確認する:

```bash
# list フィクスチャ: レコードが含まれていること
grep -c 'Template=' __fixtures__/patterns/{pattern}/search-result.html

# detail フィクスチャ: 発言データが含まれていること
grep -c 'voice' __fixtures__/patterns/{pattern}/detail.html
# または（新形式）
grep -c 'page-text__voice' __fixtures__/patterns/{pattern}/page.html

# detail フィクスチャ: タイトルが含まれていること
grep 'command__docname\|command__title\|view__title' __fixtures__/patterns/{pattern}/detail.html
```

### Step 6: list 統合テストの作成

`{adapter-name}/list.integration.test.ts` を作成する。

```typescript
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
// アダプター固有の関数を import
import { fetchMeetingList, parseListHtml, hasNextPage } from "./list";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );
```

テストは2層で書く:

#### 6a. パース関数の実データテスト

`parseListHtml` 等のパース関数に実データフィクスチャを渡し、出力を検証する。

```typescript
describe("parseListHtml with real fixtures", () => {
  test("{pattern-name}: {特徴} リンクからレコードを抽出", () => {
    const html = fixture("{pattern-name}", "search-result.html");
    const records = parseListHtml(html, "https://...");

    expect(records).toHaveLength(/* フィクスチャの実際のレコード数 */);
    expect(records[0]!.id).toBe("/* フィクスチャの実際の ID */");
    expect(records[0]!.title).toBe("/* フィクスチャの実際のタイトル */");
    // 日付があるパターンの場合
    expect(records[0]!.date).toBe("YYYY-MM-DD");
  });
});
```

#### 6b. fetchMeetingList 統合テスト

`fetch` をモックして完全なフローをテストする。

```typescript
describe("fetchMeetingList integration", () => {
  afterEach(() => vi.restoreAllMocks());

  test("{pattern-name}: 検索フローで一覧を取得", async () => {
    const topHtml = fixture("{pattern-name}", "top.html");
    const searchHtml = fixture("{pattern-name}", "search-result.html");

    const mockFetch = vi.fn();
    // 1st call: GET top page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(topHtml),
      headers: new Headers({ "set-cookie": "session=test; path=/" }),
    });
    // 2nd call: POST search
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(searchHtml),
      headers: new Headers(),
    });
    // hasNextPage=true の場合: 3rd call は空レスポンスで打ち切り
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("<html></html>"),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchMeetingList("https://...", 2024);

    expect(records).not.toBeNull();
    expect(records!.length).toBe(/* 期待レコード数 */);
    // POST パラメータの検証
    const postCall = mockFetch.mock.calls[1];
    expect(postCall![1].method).toBe("POST");
  });
});
```

### Step 7: detail 統合テストの作成

`{adapter-name}/detail.integration.test.ts` を作成する。

テストは2層で書く:

#### 7a. パース関数の実データテスト

```typescript
describe("extractTitle with real fixtures", () => {
  test("{pattern}: {class名} から抽出", () => {
    const html = fixture("{pattern}", "detail.html");
    expect(extractTitle(html)).toBe("/* 実際のタイトル */");
  });
});

describe("extractStatements with real fixtures", () => {
  test("{pattern}: {voice形式} で発言を抽出", () => {
    const html = fixture("{pattern}", "detail.html");
    const stmts = extractStatements(html);

    expect(stmts.length).toBeGreaterThan(0);
    // 最初の発言者の検証（発言者なしの entry もあり得る）
    // offset の連続性検証
    for (let i = 1; i < stmts.length; i++) {
      expect(stmts[i]!.startOffset).toBe(stmts[i - 1]!.endOffset + 1);
    }
  });
});
```

#### 7b. fetchMeetingDetail 統合テスト

```typescript
describe("fetchMeetingDetail integration", () => {
  afterEach(() => vi.restoreAllMocks());

  // 単一ページ型
  test("{pattern}: 単一ページから MeetingData を取得", async () => {
    const detailHtml = fixture("{pattern}", "detail.html");
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(detailHtml),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchMeetingDetail("https://...", "test-id", "doc-id");
    expect(result).not.toBeNull();
    expect(result!.title).toBe("/* 実際のタイトル */");
    expect(result!.heldOn).toBe("YYYY-MM-DD");
    expect(result!.statements.length).toBeGreaterThan(0);
  });

  // フレームセット型
  test("{pattern}: フレームセットから MeetingData を取得", async () => {
    const framesetHtml = fixture("{pattern}", "frameset.html");
    const commandHtml = fixture("{pattern}", "command.html");
    const pageHtml = fixture("{pattern}", "page.html");

    const mockFetch = vi.fn();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(framesetHtml),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(commandHtml),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(pageHtml),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await fetchMeetingDetail(
      "https://...?Template=doc-one-frame&...",
      "test-id",
      "doc-id",
      "list-title",  // listTitle フォールバック
      "2024-12-25",  // listDate フォールバック
    );
    expect(result).not.toBeNull();
  });
});
```

### Step 8: テスト実行と検証

```bash
# 統合テストのみ実行
cd packages/scrapers && npx vitest run src/adapters/{adapter-name}/list.integration.test.ts
cd packages/scrapers && npx vitest run src/adapters/{adapter-name}/detail.integration.test.ts

# 既存テストを含む全テスト実行（リグレッション確認）
cd packages/scrapers && npx vitest run
```

### Step 9: コミット・プッシュ・PR

worktree ルールに従い、PR まで自動で作成する。

## アサーション方針

テスト規約（`.claude/rules/test-writing-guidelines.md`）に従う:

- **期待値はベタ書き**: フィクスチャの内容を確認して、ID・タイトル・日付・レコード数をリテラルで記述
- **ヘルパー関数を使わない**: fixture 読み込み関数のみ例外
- **id は変数参照**: テスト間で共有する ID はフィクスチャから取得した値を使う

パターン固有のアサーション:
- レコード数が正しいこと（フィクスチャの実データ数と一致）
- ID・タイトル・日付のフォーマットが正しいこと
- 発言者の speakerRole / speakerName が正しく抽出されること
- meetingType が正しく分類されること（plenary / committee / extraordinary）
- offset が連続していること

## 既存テストとの参考実装

dbsearch の統合テストが先行実装されている:

```
packages/scrapers/src/adapters/dbsearch/
├── __fixtures__/patterns/
│   ├── template-view/    # 旧形式（音更町）
│   ├── document-id/      # 中間形式（仙台市）
│   └── doc-one-frame/    # フレームセット形式（青森市）
├── list.integration.test.ts
└── detail.integration.test.ts
```

## 注意事項

- フィクスチャ HTML は**公開されている議事録データ**であり匿名化は不要
- サイトからの取得時は `User-Agent: open-gikai-bot/1.0` ヘッダーを付ける
- detail フィクスチャは必ず「本文」レコードを使う（「名簿」「表紙」は発言データを含まない）
- フレームセット型は**セッション付きで連続取得**する必要がある（Cookie を引き回すこと）
- discussnet-ssp は HTML ではなく JSON API のため、フィクスチャは `.json` ファイルになる
