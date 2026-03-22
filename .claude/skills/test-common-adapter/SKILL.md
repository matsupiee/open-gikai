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

| アダプター | ディレクトリ | パターン | 導出元 |
|---|---|---|---|
| dbsearch | `adapters/dbsearch/` | template-view, document-id, doc-one-frame | `list.ts` の `anchorPattern` 正規表現で分岐する Template 値、`detail.ts` の frameset 判定 |
| kensakusystem | `adapters/kensakusystem/` | sapphire, cgi, index-html | `list.ts` の `isSapphireType` / `isCgiType` / `isIndexHtmlType` 判定関数 |
| discussnet-ssp | `adapters/discussnet-ssp/` | saas, self-hosted, smart | `index.ts` の `isSelfHosted` / `isDiscussvision` 分岐、`shared.ts` の `buildApiBase` |
| gijiroku-com | `adapters/gijiroku-com/` | standard, self-hosted-voices, asp | `seeds/seed-municipality.ts` の `detectSystemType` の URL パターン分岐（`gijiroku.com` / `/VOICES/` / `g0[78]v_search.asp`） |

パターン名はフィクスチャのディレクトリ名として使う。新たなパターンが見つかった場合は、コード内の分岐条件から命名してディレクトリを追加する。

## 実行手順

### Step 1: アダプターのコード調査

対象アダプターの `index.ts` を起点に全ファイルを読み、パターンの分岐ポイントを特定する。

**アダプターごとのファイル構成が異なる**ため、まず実際のファイル一覧を確認すること:

```bash
ls packages/scrapers/src/adapters/{adapter-name}/
```

参考: 各アダプターの主要ファイル構成

| アダプター | list フェーズ | detail フェーズ | その他 |
|---|---|---|---|
| dbsearch | `list.ts` | `detail.ts` | — |
| kensakusystem | `list.ts`, `list-fetch.test.ts` | `detail.ts` | `shared.ts`（Shift_JIS エンコーディング） |
| discussnet-ssp | `schedule.ts`（API 呼び出し） | `minute.ts`（API 呼び出し） | `shared.ts`（API base URL 構築） |
| gijiroku-com | `list.ts` | `detail.ts` | `fetch-page.ts`, `url.ts`, `decode-shift-jis.ts` |

確認すべきポイント:
- **index.ts**: `fetchList` / `fetchDetail` の呼び出し先と引数の構造
- **list / schedule 系ファイル**: URL パターンの分岐（if/switch）、パース関数の分岐
- **detail / minute 系ファイル**: レスポンス構造の分岐（HTML パース or JSON パース）
- **ファイル先頭のコメント**: 「バリアント」や「形式」の記載があることが多い

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

### Step 4: フィクスチャの取得

アダプターの種類（HTML ベース / JSON API ベース）に応じて取得方法が異なる。
いずれも **bun スクリプトで一括取得** する。

#### 4a. HTML ベースのアダプター（dbsearch, kensakusystem, gijiroku-com）

セッション管理が必要なサイトが多いため、Cookie を引き回しながら取得する。

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

#### 4b. JSON API ベースのアダプター（discussnet-ssp）

discussnet-ssp は HTML パースではなく JSON API を呼び出す。取得スクリプトも API 呼び出しベースになる。

```typescript
// /tmp/fetch-discussnet-fixtures.ts

import { writeFileSync, mkdirSync } from "node:fs";

const UA = "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

interface SspSiteConfig {
  pattern: string;
  tenantSlug: string;
  host?: string;          // self-hosted の場合
  tenantJsUrl?: string;   // smart の場合
  year: number;
}

const sites: SspSiteConfig[] = [
  // SaaS 例: { pattern: "saas", tenantSlug: "xxx", year: 2024 }
  // self-hosted 例: { pattern: "self-hosted", tenantSlug: "xxx", host: "https://...", year: 2024 }
];

async function fetchSspPattern(config: SspSiteConfig) {
  const dir = `packages/scrapers/src/adapters/discussnet-ssp/__fixtures__/patterns/${config.pattern}`;
  mkdirSync(dir, { recursive: true });

  // 1. tenant.js を取得して保存
  const tenantJsUrl = config.tenantJsUrl
    ?? (config.host
      ? `${config.host}/tenant/${config.tenantSlug}/js/tenant.js`
      : `https://ssp.kaigiroku.net/tenant/${config.tenantSlug}/js/tenant.js`);
  const tenantRes = await fetch(tenantJsUrl, { headers: { "User-Agent": UA } });
  writeFileSync(`${dir}/tenant.js`, await tenantRes.text());

  // 2. tenant_id を抽出して council API を呼び出し
  // const apiBase = config.host ? buildApiBase(config.host) : "https://ssp.kaigiroku.net";
  // const councilsUrl = `${apiBase}/api/v1/councils?tenant_id=${tenantId}&year=${config.year}`;
  // → councils.json として保存

  // 3. schedule API を呼び出し → schedules.json として保存

  // 4. minute API を呼び出し → minute.json として保存
}
```

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
// アダプター固有の関数を import（関数名はアダプターごとに異なる）
// dbsearch:       import { fetchMeetingList, parseListHtml, hasNextPage } from "./list";
// kensakusystem:  import { fetchMeetingList, ... } from "./list";
// discussnet-ssp: import { fetchTenantId, fetchCouncils, fetchSchedules } from "./schedule";
// gijiroku-com:   import { fetchMeetingList, ... } from "./list";

const fixture = (pattern: string, file: string) =>
  readFileSync(
    join(__dirname, "__fixtures__/patterns", pattern, file),
    "utf-8",
  );
```

テストは2層で書く。以下のサンプルコードは **HTML ベースのアダプター（dbsearch 等）の場合**。
discussnet-ssp の場合は JSON レスポンスのモックに置き換えること（後述の「discussnet-ssp 固有のテストパターン」参照）。

#### 6a. パース関数の実データテスト

list フェーズのパース関数に実データフィクスチャを渡し、出力を検証する。
関数名はアダプターごとに異なるため、Step 1 で調査した export 関数を使う。

```typescript
// dbsearch の例
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

#### 6b. ScraperAdapter.fetchList 統合テスト

`fetch` をモックして完全なフローをテストする。

```typescript
// HTML ベースのアダプターの例（dbsearch / kensakusystem / gijiroku-com）
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
    // hasNextPage がある場合: 次のコールは空レスポンスで打ち切り
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve("<html></html>"),
      headers: new Headers(),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchMeetingList("https://...", 2024);

    expect(records).not.toBeNull();
    expect(records!.length).toBe(/* 期待レコード数 */);
  });
});
```

#### discussnet-ssp 固有のテストパターン

discussnet-ssp は JSON API を使うため、フィクスチャとモックの構成が異なる。

```typescript
// discussnet-ssp の list テスト例
import { fetchTenantId, fetchCouncils, fetchSchedules } from "./schedule";

describe("fetchTenantId with real fixtures", () => {
  afterEach(() => vi.restoreAllMocks());

  test("{pattern}: tenant.js から tenantId を取得", async () => {
    const tenantJs = fixture("{pattern}", "tenant.js");
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(tenantJs),
    });
    vi.stubGlobal("fetch", mockFetch);

    const tenantId = await fetchTenantId("{slug}");
    expect(tenantId).toBe(/* フィクスチャの実際の tenantId */);
  });
});

describe("fetchCouncils with real fixtures", () => {
  test("{pattern}: 会議一覧を取得", async () => {
    const councilsJson = fixture("{pattern}", "councils.json");
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(JSON.parse(councilsJson)),
    });
    vi.stubGlobal("fetch", mockFetch);

    const councils = await fetchCouncils(/* tenantId */, /* year */);
    expect(councils.length).toBeGreaterThan(0);
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
- **ヘルパー関数を使わない**: `readFileSync` ベースのフィクスチャ読み込み関数のみ例外（`test-writing-guidelines.md` に明記済み）
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
