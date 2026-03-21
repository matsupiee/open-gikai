# 吉野町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.yoshino.nara.jp/gikai/kaigiroku/index.html
- 分類: 公式サイト内に年度別 PDF 一覧（独自 CMS: SMART CMS）
- 提供形式: PDF（各会議ごとに 1 ファイル）
- 掲載期間: 10 年間（令和2年〜令和8年、平成28年〜平成31年）
- 特記: ページネーションなし、年度ごとの子ページに PDF リンクを掲載

---

## URL 構造

| ページ | URL |
| --- | --- |
| 会議録インデックス | `https://www.town.yoshino.nara.jp/gikai/kaigiroku/index.html` |
| 年度別一覧（令和8年） | `https://www.town.yoshino.nara.jp/gikai/kaigiroku/1870.html` |
| 年度別一覧（令和7年） | `https://www.town.yoshino.nara.jp/gikai/kaigiroku/1570.html` |
| 年度別一覧（令和6年） | `https://www.town.yoshino.nara.jp/gikai/kaigiroku/1342.html` |
| PDF ファイル | `https://www.town.yoshino.nara.jp/material/files/group/20/{ファイル名}.pdf` |

---

## 年度別ページ ID 一覧

| 年度 | ページID | URL |
| --- | --- | --- |
| 令和8年 | 1870 | `/gikai/kaigiroku/1870.html` |
| 令和7年 | 1570 | `/gikai/kaigiroku/1570.html` |
| 令和6年 | 1342 | `/gikai/kaigiroku/1342.html` |
| 令和5年 | 1252 | `/gikai/kaigiroku/1252.html` |
| 令和4年 | 1251 | `/gikai/kaigiroku/1251.html` |
| 令和3年 | 1250 | `/gikai/kaigiroku/1250.html` |
| 令和2年 | 1249 | `/gikai/kaigiroku/1249.html` |
| 平成31年（令和元年） | 1248 | `/gikai/kaigiroku/1248.html` |
| 平成30年 | 1241 | `/gikai/kaigiroku/1241.html` |
| 平成29年 | 1240 | `/gikai/kaigiroku/1240.html` |
| 平成28年 | 1239 | `/gikai/kaigiroku/1239.html` |

---

## PDF ファイル名パターン

### 令和年（R）

```
R{年}_{種別}{回数}_{月2桁}.pdf
```

| フィールド | 説明 | 例 |
| --- | --- | --- |
| `R{年}` | 令和年（数字） | `R7` = 令和7年 |
| `{種別}` | `teirei`（定例会）/ `rin`（臨時会） | `teirei`, `rin` |
| `{回数}` | 第X回（数字） | `1`, `2`, `3`, `4` |
| `_{月2桁}` | 開催月（2桁） | `_03` = 3月 |

例:
- `R7_teirei1_03.pdf` → 令和7年第1回定例会（3月）
- `R7_rin2_07.pdf` → 令和7年第2回臨時会（7月）
- `R6_rin1_02.pdf` → 令和6年第1回臨時会（2月）

### 平成年（H）

```
H{年}_{種別}{回数}_{月2桁}.pdf
```

例:
- `H31_teirei1_03.pdf` → 平成31年第1回定例会（3月）
- `H31_rin1_01.pdf` → 平成31年第1回臨時会（1月）

### 令和元年の混在

平成31年（令和元年）のページには、元号切り替えをまたぐため両方の命名が混在する。

- 平成31年分: `H31_...`
- 令和元年分: `R1_...`

---

## 会議種別と件数の実績

令和2年〜令和7年の実績から、年度あたりの会議数は概ね以下の通り:

- 定例会: 年4回（3月・6月・9月・12月）
- 臨時会: 年1〜4回（開催月は不定）

合計: 年あたり5〜8件程度

---

## スクレイピング戦略

### Step 1: 年度別一覧ページから PDF リンクを収集

インデックスページ（`/gikai/kaigiroku/index.html`）から各年度ページへのリンクを取得するか、上記の固定ページID一覧を直接利用する。

各年度ページ（例: `/gikai/kaigiroku/1570.html`）内の `<a>` タグのうち、`href` が `/material/files/group/20/` を含むものを抽出する。

```typescript
// PDF リンクの抽出パターン
const pdfLinks = $('a[href*="/material/files/group/20/"]');
```

### Step 2: PDF リンクのメタ情報をパース

リンクテキストから会議名・開催日を取得する。

リンクテキスト例:
```
令和7年第1回(3月)定例会 (PDFファイル: 1.9MB)
令和7年第1回臨時会(4月28日) (PDFファイル: 472.4KB)
```

```typescript
// 会議名からメタ情報抽出
const meetingPattern = /^(?:令和|平成)(\d+)年第(\d+)回(?:（|（|\()([^)）]+)(?:）|）|\))?(定例会|臨時会)/;
const datePattern = /\((\d+)月(?:(\d+)日)?\)/;
```

### Step 3: PDF のダウンロードと処理

- URL は `href` 属性値をそのまま使用（`//` から始まる場合は `https:` を補完）
- PDF を取得後、テキスト抽出ライブラリでパース

---

## 注意事項

- PDF のパスは `//www.town.yoshino.nara.jp/material/files/group/20/...` 形式（プロトコル省略）で記述されているため、`https:` を補完する必要がある
- 平成31年（令和元年）のページは `H31_` と `R1_` の両ファイル名が混在する
- 会議録は PDF のみ提供（HTML テキスト形式なし）
- CMS は SMART CMS（`api5th.smart-lgov.jp`）を使用しており、ページ構造は比較的シンプル
- レート制限: 自治体サイトのためリクエスト間に 1〜2 秒の待機を設ける

---

## 推奨アプローチ

1. **固定 URL リストを使用**: 年度別ページID（1239〜1870）は既知のため、インデックスページのクロールは不要
2. **各年度ページをフェッチ**: Cheerio で `<a href*="/material/files/group/20/">` を抽出
3. **リンクテキストからメタ情報を取得**: 会議種別・回数・開催月をパース
4. **PDF ダウンロード**: `https:` を補完して取得
5. **差分更新**: 年度ページの PDF リンク一覧を毎回取得し、未処理 URL のみダウンロードする
