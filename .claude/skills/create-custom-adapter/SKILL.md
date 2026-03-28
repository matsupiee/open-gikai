---
name: create-custom-adapter
description: 自治体ごとのカスタムスクレイピングアダプターを作成する手順
version: 3.0.0
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
└── fetchDetail({ detailParams, municipalityCode }) → MeetingData | null
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

情報がない場合は、自治体の会議録ページを調査する
もし会議録がhtmlやpdf形式で提供されてない場合は、`docs/custom-scraping/{引数}.md`に「スクレイピング不可能」という一行を加えて、PRを出す。
すでに、「スクレイピング不可能」という情報が書かれている場合は、何もせずに終了していい

### Step 2: 自治体コードの特定

`municipalities.csv` から自治体コードを取得する:

```bash
grep -i '{自治体名}' data/municipalities.csv
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

**fetchPage / fetchBinary は catch ブロックで必ず `console.warn` を出力する（サイレントエラー禁止）:**

```typescript
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

const PDF_FETCH_TIMEOUT_MS = 60_000; // PDF は大きいため長めのタイムアウト

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}
```

**和暦→西暦変換は `令和元年` / `平成元年` に必ず対応する:**

```typescript
// ❌ NG: \d+ は「元」にマッチしない → 2019年のデータが丸ごと脱落
/(令和|平成)(\d+)年/

// ✅ OK: 「元」にも対応
/(令和|平成)(元|\d+)年/
// マッチ後: eraYear = match[2] === "元" ? 1 : Number(match[2])
```

**デッドコードを残さない:**
- エクスポートした関数・変数がどこからも使用されていない場合は削除する
- `index.ts` からの再エクスポートはテストから直接インポートされている場合は不要

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

**PDF サイトの場合も必ず statements を抽出する（空配列で返してはいけない）。**
`unpdf` ライブラリ（`getDocumentProxy` + `extractText`）で PDF テキストを抽出し、○ マーカー等で発言を分割して `ParsedStatement[]` を生成する。

```typescript
// PDF テキスト抽出の基本パターン:
import { extractText, getDocumentProxy } from "unpdf";

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

// parseSpeaker(): 発言テキストから話者名・役職・本文を抽出
// classifyKind(): 役職から発言種別を分類（remark/question/answer）
// parseStatements(): テキストから ParsedStatement[] を抽出（○マーカー分割等）
// fetchMeetingData(): ドキュメントから MeetingData を組み立て
```

PDF での発言パースの典型パターン（`122106-mobara/detail.ts` を参考）:
1. `text.split(/(?=[○◯◎●])/)` で発言ブロックに分割（**複数の丸マーカーに対応すること**）
2. 各ブロックから `parseSpeaker()` で `role（name君）content` パターンを抽出
3. `classifyKind()` で役職から kind を判定
4. `createHash("sha256").update(content).digest("hex")` で contentHash を生成

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

**classifyKind の返り値型はリテラルユニオンにする:**
```typescript
// ✅ OK
function classifyKind(role: string | null): "remark" | "question" | "answer" { ... }

// ❌ NG: string では型安全性が失われる
function classifyKind(role: string | null): string { ... }
```

**contentHash の生成:**
```typescript
import { createHash } from "node:crypto";
const contentHash = createHash("sha256").update(content).digest("hex");
```

**ROLE_SUFFIXES の並び順は「長い方を先」にする（CRITICAL）:**

`endsWith` でマッチさせる場合、短いサフィックスが先にあると誤マッチする。
例: `"副委員長".endsWith("委員長")` は `true` → `副委員長` が `委員長` として記録される。

```typescript
// ✅ OK: 長い（具体的な）サフィックスを先に配置
const ROLE_SUFFIXES = [
  "副委員長", "委員長",
  "副議長", "議長",
  "副町長", "副市長", "副区長", "副村長", "町長", "市長", "区長", "村長",
  "副部長", "部長",
  "副課長", "課長",
  "副教育長", "教育長",
  "事務局長", "局長",
  "議員", "委員",
];

// ❌ NG: 「委員長」が「副委員長」より先 → 誤マッチ
const ROLE_SUFFIXES = ["委員長", "副委員長", ...];
```

同様に、正規表現の交代（alternation）でも長いパターンを先に配置する:
```typescript
// ✅ OK: 長いパターン優先
/(?=副\s*議\s*長|議\s*長|教\s*育\s*文\s*化\s*課\s*長|課\s*長)/

// ❌ NG: 「議長」が「副議長」内部でマッチ → 「副」と「議長」に誤分割
/(?=議\s*長|副\s*議\s*長|課\s*長|教\s*育\s*文\s*化\s*課\s*長)/
```

**fetchMeetingData で statements が空なら null を返す（CRITICAL）:**

```typescript
async function fetchMeetingData(...): Promise<MeetingData | null> {
  // ...
  const statements = parseStatements(text);
  // ✅ 必須: 空 statements の MeetingData が DB に保存されるのを防ぐ
  if (statements.length === 0) return null;
  // ...
}
```

**heldOn が解析できない場合は `null` を返す（`"1970-01-01"` などのフォールバック値は禁止）:**

```typescript
// ❌ NG: epoch date が DB に保存され、クエリで意図せず除外される
const heldOn = parseDateText(text) ?? "1970-01-01";

// ✅ OK: null を返して呼び出し元でスキップ
const heldOn = parseDateText(text);
if (!heldOn) continue; // or return null
```

**PDF 複数ダウンロード時の sleep はループ最後では不要:**

```typescript
for (let i = 0; i < pdfUrls.length; i++) {
  const text = await fetchPdfText(pdfUrls[i]);
  // ... 処理 ...
  if (i < pdfUrls.length - 1) {
    await new Promise((r) => setTimeout(r, 1000)); // 最後の1件ではスキップ
  }
}
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

  async fetchDetail({ detailParams, municipalityCode }) {
    // detailParams をキャストして MeetingData を返す
    const params = detailParams as { ... };
    return fetchMeetingData(params, municipalityCode);
  },
};
```

**index.ts は `adapter` のエクスポートのみに絞る。** テスト用の関数（`parseSpeaker`, `classifyKind` 等）はテストファイルから直接 `./detail`, `./list` をインポートするため、`index.ts` からの再エクスポートは不要。

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
- **statements が空でないことを確認する**（PDF サイトでも `unpdf` でテキスト抽出し発言パースまで行う）
- 出力された NDJSON の内容（会議名、発言者、発言内容など）が妥当か目視チェックする

### Step 12: コミット・プッシュ・PR

.claude/rules/worktree-workflow ルールに従い、PR まで自動で作成する。

**ブランチは必ず `main` から切る（CRITICAL）:**

他の自治体のブランチや現在の HEAD ではなく、必ず `origin/main` を起点にすること。バッチ並列実行時に複数ブランチが連鎖するのを防ぐ。

```bash
git fetch origin
git checkout -b feat/adapter-{自治体コード}-{名前} origin/main
```

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
