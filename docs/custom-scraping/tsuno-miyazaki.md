# 都農町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tsuno.lg.jp/
- 分類: SPA（Angular）+ Azure Blob Storage による PDF 公開（既存アダプターでは対応不可）
- CMS: UrbanOS（SPA ベースの自治体向け CMS）
- 特記: サイト全体が Angular SPA のため、HTML 取得では中身が得られない。バックエンド REST API を直接叩く必要あり。

---

## 会議録の所在

会議録は 2 つの記事ページに分かれて PDF で公開されている。

| 区分 | articleId | 収録期間 |
| --- | --- | --- |
| 令和元年度以降 | `61a84c6d87decd0dbb681baa` | 平成31年/令和元年〜令和7年（現在） |
| 平成30年度以前 | `61a84ef987decd0dbb681c31` | 平成21年〜平成30年 |

対応するフロントエンド URL:

- `https://www.town.tsuno.lg.jp/article?articleId=61a84c6d87decd0dbb681baa`
- `https://www.town.tsuno.lg.jp/article?articleId=61a84ef987decd0dbb681c31`

---

## API 構造

### バックエンド API ベース URL

```
https://www.town.tsuno.lg.jp/prd/tno
```

### 記事詳細取得エンドポイント

```
POST https://www.town.tsuno.lg.jp/prd/tno/portal/openapi/v1/article/detail/retrieve
Content-Type: application/json
```

### リクエストボディ（必須パラメータ）

```json
{
  "tenantId": "2",
  "siteId": "201",
  "langCode": "JPN",
  "pageId": "PTARS51",
  "articleId": "61a84c6d87decd0dbb681baa"
}
```

| パラメータ | 値 | 説明 |
| --- | --- | --- |
| `tenantId` | `"2"` | 固定値（都農町テナント） |
| `siteId` | `"201"` | 固定値（都農町サイト） |
| `langCode` | `"JPN"` | 言語コード（`JPN`, `ENG`, `CHN`, `KOR`, `VNM` から選択） |
| `pageId` | `"PTARS51"` | 記事一覧ページ ID |
| `articleId` | （記事 ID） | 取得対象の記事 ID |

### レスポンス構造

レスポンスの `data.jpn.contentsSec.textContentSec` 配列に、記事の各セクションが格納される。

```typescript
interface TextContentSec {
  textType: "C" | "T1" | "L";  // C=本文, T1=見出し, L=リンク
  textContent: string | null;
  linkDisplayName: string | null;
  linkUrl: string | null;
  textContentSortOrder: number;
}
```

- `textType: "T1"` → 年度ごとの見出し（例: `令和7年定例会会議録`）
- `textType: "L"` → PDF へのリンク（`linkDisplayName` にラベル、`linkUrl` に PDF URL）
- `textType: "C"` → 説明テキスト

---

## PDF URL 構造

PDF は Azure Blob Storage 上にホストされている。

### ベース URL

```
https://prdurbanostnoapp1.blob.core.windows.net/common-article/{articleId}/
```

### ファイル名パターン

ファイル名は**統一されておらず**、以下のような複数のパターンが混在する。

| 時期 | ファイル名例 | 備考 |
| --- | --- | --- |
| 令和4年以降 | `（ホームページ用）令和７年第１回定例会会議録.pdf` | URL エンコード済み日本語ファイル名 |
| 令和2〜3年頃 | `（閲覧用）令和3年第1回定例会会議録.pdf` | プレフィックスが「閲覧用」 |
| 令和2年以前 | `2-1T.pdf`, `31-1R.pdf`, `1-2R.pdf` | 簡略記号（年-回数+種別） |
| 一部 | `R503（ホームページ用）...pdf` | プレフィックスにコード付き |

**ファイル名にルールがないため、API レスポンスから `linkUrl` を直接取得する必要がある。** URL を推測するアプローチは不可。

---

## 会議の種別

| 種別 | 見出し例 | 年間回数 |
| --- | --- | --- |
| 定例会 | `令和7年定例会会議録` | 年 4 回（第1回〜第4回） |
| 臨時会 | `令和7年臨時会会議録` | 年 1〜6 回（不定） |

---

## スクレイピング戦略

### Step 1: PDF URL リストの取得

2 つの記事ページの API を叩き、全 PDF リンクを抽出する。

```typescript
const ARTICLE_IDS = [
  "61a84c6d87decd0dbb681baa", // 令和元年度以降
  "61a84ef987decd0dbb681c31", // 平成30年度以前
];

const API_URL = "https://www.town.tsuno.lg.jp/prd/tno/portal/openapi/v1/article/detail/retrieve";

for (const articleId of ARTICLE_IDS) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tenantId: "2",
      siteId: "201",
      langCode: "JPN",
      pageId: "PTARS51",
      articleId,
    }),
  });

  const data = await response.json();
  const sections = data.data.jpn.contentsSec.textContentSec;

  let currentHeading = "";
  for (const sec of sections) {
    if (sec.textType === "T1") {
      currentHeading = sec.textContent; // 例: "令和7年定例会会議録"
    } else if (sec.textType === "L" && sec.linkUrl) {
      // currentHeading からメタ情報を抽出し、PDF URLとセットで保存
      console.log({ heading: currentHeading, label: sec.linkDisplayName, url: sec.linkUrl });
    }
  }
}
```

### Step 2: メタ情報の抽出

見出し（`textType: "T1"`）とリンクラベル（`linkDisplayName`）からメタ情報を抽出する。

**見出しのパターン:**

```typescript
// 見出しから年度と種別を抽出
const headingPattern = /(?:平成|令和)(\d+)年(?:・令和(\d+)年)?\s*(定例会|臨時会)会議録/;
// 例: "令和7年定例会会議録" → era="令和", year=7, type="定例会"
// 例: "平成31年・令和元年 定例会会議録" → 両方の年度にマッチ
```

**リンクラベルのパターン:**

```typescript
// リンクラベルから回数と種別を抽出
const labelPattern = /(?:平成(\d+)年|令和(\d+)年)?第(\d+)回(定例会|臨時会)/;
// 例: "令和7年第1回定例会（PDFファイル)" → year=7, session=1, type="定例会"
// 例: "第1回定例会(PDFファイル)" → year=null(見出しから取得), session=1
```

### Step 3: PDF のダウンロードとテキスト抽出

- PDF は Azure Blob Storage から直接ダウンロード可能（認証不要）
- PDF からテキスト抽出が必要（`pdf-parse` 等を使用）
- 1 ファイルにつき 1 回分の会議録全体が含まれる

---

## 注意事項

- サイトは SPA（Angular）のため、通常の HTML スクレイピングでは中身が取得できない
- API エンドポイントは `openapi` 系（認証不要）を使用すること。`api` 系は認証が必要
- PDF ファイル名に規則性がないため、必ず API レスポンスの `linkUrl` から取得する
- PDF ファイルの URL は日本語を含み URL エンコードされている。末尾に余分なスペースが入っている場合がある
- 個人情報保護の観点から、一部が白丸記号に置換されている場合がある（公式注記あり）
- 会議録は定例会 1 回分 = 1 PDF であり、日ごとの分割はない
- 問い合わせ先: 議会事務局議事係 0983-25-5718

---

## 推奨アプローチ

1. **API 経由で PDF URL を一括取得**: 2 つの articleId に対して API を叩くだけで全 PDF URL が取得できる（HTML パース不要）
2. **PDF テキスト抽出**: PDF 内のテキストを抽出して発言内容を取得する
3. **レート制限**: Azure Blob Storage へのアクセスだが、適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: API レスポンスの `textContentSortOrder` は昇順で並んでいるため、前回取得時のリンク数と比較して新規分のみを取得可能
5. **BODIK オープンデータ**: `https://data.bodik.jp/dataset/454061_council_record` でもデータセットが公開されている（CC BY 4.0）が、実際のリソースは同じ SPA ページへのリンクのみ
