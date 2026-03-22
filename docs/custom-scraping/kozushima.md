# 神津島村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.kouzushima.tokyo.jp/busyo/gikai/
- 分類: WordPress による PDF 公開（一括検索機能なし）
- 文字コード: UTF-8
- 特記: 会議録は個別の WordPress 投稿ページから PDF ファイルとしてダウンロード。HTML 本文での会議録公開はなし。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.vill.kouzushima.tokyo.jp/busyo/gikai/` |
| 議会カテゴリ一覧 | `https://www.vill.kouzushima.tokyo.jp/category/gikai/` |
| 議会カテゴリ一覧（ページ N） | `https://www.vill.kouzushima.tokyo.jp/category/gikai/page/{N}/` |
| 会議録個別ページ | `https://www.vill.kouzushima.tokyo.jp/{YYYY-MMDD}/` |
| 会議録 PDF | `https://www.vill.kouzushima.tokyo.jp/images/{YYYY}/{MM}/{filename}.pdf` |

### 個別ページ URL の例

| 会議 | URL |
| --- | --- |
| 令和7年第4回定例会 | `https://www.vill.kouzushima.tokyo.jp/2026-0206/` |
| 令和7年第1回臨時会 | `https://www.vill.kouzushima.tokyo.jp/2025-0301/` |
| 令和6年第3回定例会 | `https://www.vill.kouzushima.tokyo.jp/2024-1119/` |

### PDF URL の例

| 会議 | PDF URL |
| --- | --- |
| 令和7年第4回定例会 | `https://www.vill.kouzushima.tokyo.jp/images/2026/02/teireikai-20260205.pdf` |
| 令和7年第1回臨時会 | `https://www.vill.kouzushima.tokyo.jp/images/2025/03/20250301_rinji.pdf` |
| 令和6年第3回定例会 | `https://www.vill.kouzushima.tokyo.jp/images/2024/11/20241119_teireikai.pdf` |
| 令和5年第1回定例会 | `https://www.vill.kouzushima.tokyo.jp/images/2023/06/202303_teireikai.pdf` |

※ PDF ファイル名の命名規則は統一されておらず、`teireikai-YYYYMMDD.pdf`、`YYYYMMDD_teireikai.pdf`、`YYYYMM_teireikai.pdf` など複数のパターンが存在する。

---

## サイト構造

### 議会トップページ (`/busyo/gikai/`)

- 「議会からのお知らせ」セクション: 最新の投稿一覧（会議録 + 議会だより混在）
- 「会議記録」セクション: 会議録へのリンク一覧（定例会・臨時会）
- 「議員名簿」「請願・陳情」セクション

### カテゴリ一覧ページ (`/category/gikai/`)

- WordPress カテゴリアーカイブ
- ページネーション: 全 5 ページ（2026 年 3 月時点）
- 会議録と議会だよりが混在

### 会議録個別ページ (`/{YYYY-MMDD}/`)

- WordPress 投稿ページ
- ページ内に PDF ダウンロードリンクが 1 つ
- PDF リンクのテキスト: `{会議名}：PDF` 形式

---

## 会議種別

| 種別 | PDF ファイル名キーワード |
| --- | --- |
| 定例会 | `teireikai` |
| 臨時会 | `rinji` |

※ 委員会の会議録は公開されていない。

---

## 公開範囲

- 確認できる最古の会議録: 令和5年第1回定例会（2023年6月27日公開）
- 最新: 令和7年第4回定例会（2026年2月5日公開）
- WordPress サイトへの移行以前の会議録は確認できず

---

## スクレイピング戦略

### Step 1: 会議録ページ URL の収集

カテゴリ一覧ページ `/category/gikai/` を全ページ巡回し、会議録の個別ページ URL を収集する。

**収集方法:**

1. `/category/gikai/page/{N}/` を N=1 から順にアクセス（404 またはページなしで終了）
2. 各ページから投稿リンクを抽出
3. タイトルに「会議録」を含むリンクのみをフィルタリング（「議会だより」等を除外）

**抽出対象:**

```
<a href="https://www.vill.kouzushima.tokyo.jp/{YYYY-MMDD}/">神津島村議会{定例会|臨時会}会議録(令和X年第Y回)</a>
```

### Step 2: PDF URL の取得

各会議録個別ページにアクセスし、PDF ダウンロードリンクを抽出する。

**抽出方法:**

- ページ内の `<a>` タグから `.pdf` で終わる `href` を取得
- PDF URL のドメインは `https://www.vill.kouzushima.tokyo.jp/images/` 配下

### Step 3: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、テキスト抽出を行う。

- PDF パーサー（pdf-parse 等）でテキストを抽出
- 会議録は全文がPDFに含まれる

### Step 4: メタ情報の抽出

#### 投稿タイトルからの抽出

```
神津島村議会定例会会議録(令和7年第4回)
神津島村議会臨時会会議録(令和7年第1回)
```

- 会議種別: `定例会` or `臨時会`
- 年号: `令和X年`
- 回次: `第Y回`

#### パース用正規表現（案）

```typescript
// タイトルからメタ情報を抽出
const titlePattern = /神津島村議会(定例会|臨時会)会議録\((.+?)第(\d+)回\)/;
// 例: 神津島村議会定例会会議録(令和7年第4回) → type="定例会", era="令和7年", num="4"
```

---

## 注意事項

- PDF ファイル名の命名規則が統一されていないため、ファイル名からのメタ情報抽出は不安定。タイトルテキストからの抽出を優先する。
- 議会だよりも同じカテゴリに混在するため、タイトルによるフィルタリングが必須。
- WordPress サイトのため、`wp-json` REST API (`/wp-json/wp/v2/posts?categories={gikai_id}`) でも投稿一覧を取得できる可能性がある。
- 会議録は HTML 本文ではなく PDF のみで公開されているため、PDF パーサーが必須。

---

## 推奨アプローチ

1. **カテゴリ一覧からの巡回を優先**: `/category/gikai/page/{N}/` を全ページ巡回し、会議録ページを特定
2. **WordPress REST API の活用を検討**: `wp-json` エンドポイントが有効であれば、HTML パースよりも安定的に投稿一覧を取得可能
3. **PDF テキスト抽出**: pdf-parse 等のライブラリで PDF からテキストを抽出
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: カテゴリ一覧の1ページ目で最新の投稿を確認し、既知の会議録と比較して差分のみ取得
