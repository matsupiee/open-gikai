# 南種子町議会 カスタムスクレイピング方針

## 概要

- サイト: http://www.town.minamitane.kagoshima.jp/
- 分類: 町公式サイトで PDF を直接公開（外部の専用検索システムは使用していない）
- 文字コード: UTF-8
- 特記: Imperva CDN を使用。HTTP でアクセス可能（HTTPS は接続拒否）

---

## URL 構造

| ページ | URL |
| --- | --- |
| 会議録一覧 | `http://www.town.minamitane.kagoshima.jp/industry/assembly/minutes.html` |
| PDF ファイル（定例会） | `http://www.town.minamitane.kagoshima.jp/assets/files/pdf/gikai/{ファイル名}.pdf` |
| PDF ファイル（臨時会） | `http://www.town.minamitane.kagoshima.jp/assets/files/pdf/gikai/{ファイル名}.pdf` |

---

## ページ構造

会議録一覧ページは単一の HTML ページ。年度ごとに `<h3>` 見出しで区切られ、各会議の PDF リンクが `<p>` タグ内に列挙されている。

```html
<h3>令和7年</h3>
<table style="width: 100%;" align="center">
  ...
  <p>第3回定例会（<a href="assets/files/pdf/gikai/R07dai3kaiteireikaikaigiroku.pdf">PDF</a>）</p>
  <p>第4回臨時会（<a href="assets/files/pdf/gikai/R7dai4kairinjikaikaigiroku.pdf">PDF</a>）</p>
  ...
</table>
```

- 各年度のエントリは `<table>` 要素内の `<p>` タグにまとめられている
- PDF リンクがない（未掲載）のエントリは `<p>第N回定例会（PDF）</p>` のようにリンクなしのテキストのみとなる

---

## 掲載年度範囲

平成27年（2015年）〜 令和8年（2026年）

| 年度 | 表記 |
| --- | --- |
| 平成27年 | H27 |
| 平成28年 | H28 |
| 平成29年 | H29 |
| 平成30年 | H30 |
| 平成31年（令和元年） | H31 / R01 / R1 |
| 令和2年 | R02 / R2 |
| 令和3年 | R03 / R3 |
| 令和4年 | R04 / R4 |
| 令和5年 | R05 / R5 |
| 令和6年 | R06 / R6 |
| 令和7年 | R07 / R7 |
| 令和8年 | R8 |

---

## PDF ファイルの命名規則

### 定例会

```
{元号略称}{年号}dai{回数}kaiteireikaikaigiroku.pdf
```

| 要素 | 説明 | 例 |
| --- | --- | --- |
| 元号略称 | `R`（令和）/ `H`（平成） | `R07` / `H30` |
| 年号 | 2桁ゼロ埋め（令和）または2桁（平成）※ゼロ埋めなし年あり | `07` / `30` |
| 回数 | `dai` + 回次数字 | `dai3` |
| 種別 | `kaiteireikaikaigiroku` | 固定 |

例:
- `R07dai3kaiteireikaikaigiroku.pdf` → 令和7年第3回定例会
- `H30dai1kaiteireikaikaigiroku.pdf` → 平成30年第1回定例会

### 臨時会

```
{元号略称}{年号}dai{回数}kairinjikaikaigiroku.pdf
```

| 要素 | 説明 | 例 |
| --- | --- | --- |
| 元号略称 | `R`（令和）/ `H`（平成） | `R7` / `H30` |
| 年号 | ゼロ埋めなしが多い（2桁ゼロ埋め例も混在） | `7` / `30` |
| 回数 | `dai` + 回次数字 | `dai4` |
| 種別 | `kairinjikaikaigiroku` | 固定 |

例:
- `R7dai4kairinjikaikaigiroku.pdf` → 令和7年第4回臨時会
- `H30dai1kairinjikaikaigiroku.pdf` → 平成30年第1回臨時会

### 命名規則の揺れ

ファイル名には以下の揺れが確認されている:

- 元号略称の大文字・小文字混在: 平成27年の一部ファイルが `h27`（小文字）
- 年号のゼロ埋め有無:
  - 定例会は `R07`（2桁ゼロ埋め）が多いが、`R01`（令和元年）など元年も同様
  - 臨時会は `R7`（ゼロ埋めなし）が多い
  - 例外: `R8dai1kairinjikaikaigiroku.pdf`（令和8年第1回臨時会）

ファイル名を推測するのではなく、**一覧ページの `<a href>` から URL を直接収集する**ことを強く推奨する。

---

## 会議種別

| 種別 | ファイル名内の表記 | 備考 |
| --- | --- | --- |
| 定例会 | `kaiteireikaikaigiroku` | 年4回が標準 |
| 臨時会 | `kairinjikaikaigiroku` | 年1〜7回（年によって異なる） |

委員会別の会議録は掲載されていない。すべて本会議（定例会・臨時会）のみ。

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF URL を収集

`minutes.html` を取得し、`assets/files/pdf/gikai/` を含む `<a href>` をすべて抽出する。

- リンクが相対パスのため、ベース URL `http://www.town.minamitane.kagoshima.jp/` を付与して絶対 URL に変換する
- `<a href>` が存在しない `（PDF）` テキストのみのエントリは未掲載のためスキップする
- 同一ページで全年度・全会議が一覧できるため、ページネーションは不要

```typescript
// Cheerio での収集例
const links = $('a[href*="assets/files/pdf/gikai/"]')
  .map((_, el) => {
    const href = $(el).attr('href')!;
    return new URL(href, 'http://www.town.minamitane.kagoshima.jp/').toString();
  })
  .toArray();
```

### Step 2: 各 PDF を取得・テキスト抽出

PDF ファイルを取得し、テキスト抽出ツール（pdf-parse 等）でテキスト化する。

- PDF は会議録全文（発言者・発言内容を含む）
- ファイルサイズは会議によって異なる（数百 KB 〜 数 MB 程度と推定）

### Step 3: メタ情報の取得

PDF URL と一覧ページの `<p>` テキストからメタ情報を取得する。

**一覧ページから取得できる情報:**

- 年度: `<h3>` テキスト（例: `令和7年`）
- 会議種別と回次: `<p>` テキスト（例: `第3回定例会`、`第4回臨時会`）

**パース用正規表現（案）:**

```typescript
// <h3> から年度を抽出
const yearPattern = /(?:令和|平成)(\d+)年/;
// 例: "令和7年" → era="令和", year=7

// <p> テキストから会議種別と回次を抽出
const sessionPattern = /第(\d+)回(定例会|臨時会)/;
// 例: "第3回定例会" → count=3, type="定例会"
```

---

## 注意事項

- **HTTP のみ**: HTTPS は接続拒否（`ECONNREFUSED`）。アクセスは `http://` を使用する
- **Imperva CDN**: ボット検出が稼働している可能性がある。User-Agent の設定とリクエスト間隔（1〜2秒）を設ける
- **未掲載エントリ**: リンクなし `（PDF）` は会議録が未掲載。スキップする
- **ファイル名の揺れ**: URL は直接 HTML から収集し、ファイル名を推測・構築しない
- **平成27年が最古**: サイト上では平成27年（2015年）が最初の年度

---

## 推奨アプローチ

1. **一覧ページを単一取得**: `minutes.html` の 1 リクエストで全 PDF URL を収集できる
2. **リンクあり判定**: `$('p a[href*="gikai"]')` でリンクが存在する会議のみを対象にする
3. **年度・会議種別はページから取得**: `<h3>` と `<p>` テキストを紐付けてメタ情報とする
4. **レート制限**: PDF ダウンロード時もリクエスト間に 1〜2 秒の待機を設ける
5. **差分更新**: 既取得 URL のリストと比較し、新規 URL のみ PDF を取得する
