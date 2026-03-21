# 鬼北町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kihoku.ehime.jp/site/gikai/list17-364.html
- 分類: 独自 CMS による HTML 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は年度別インデックスページを経由して PDF で提供される

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年度一覧（トップ） | `https://www.town.kihoku.ehime.jp/site/gikai/list17-364.html` |
| 年度別インデックス | `https://www.town.kihoku.ehime.jp/site/gikai/{ページID}.html` |
| 会議録 PDF | `https://www.town.kihoku.ehime.jp/uploaded/life/{ページID}_{ファイルID}_misc.pdf` |

### 年度別インデックスページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.town.kihoku.ehime.jp/site/gikai/30128.html` |
| 令和6年 | `https://www.town.kihoku.ehime.jp/site/gikai/26504.html` |
| 令和5年 | `https://www.town.kihoku.ehime.jp/site/gikai/22676.html` |
| 令和4年 | `https://www.town.kihoku.ehime.jp/site/gikai/20180.html` |
| 令和3年 | `https://www.town.kihoku.ehime.jp/site/gikai/17886.html` |
| 令和2年 | `https://www.town.kihoku.ehime.jp/site/gikai/15455.html` |
| 平成31年・令和元年 | `https://www.town.kihoku.ehime.jp/site/gikai/14360.html` |

---

## HTML 構造

### 年度一覧ページ（list17-364.html）

年度別インデックスへのリンクが `<ul>` + `<li>` + `<a>` のリスト形式で並ぶ。ページネーションなし。

```html
<ul>
  <li><a href="/site/gikai/30128.html">令和7年町議会会議録</a></li>
  <li><a href="/site/gikai/26504.html">令和6年町議会会議録</a></li>
  ...
</ul>
```

### 年度別インデックスページ

`<h3>` タグで「定例会」「臨時会」をセクション分けし、各セクション内にPDFへの直接リンクが並ぶ。ページネーションなし。

```html
<h3>定例会</h3>
<a href="/uploaded/life/{ページID}_{ファイルID}_misc.pdf">
  第X回鬼北町議会定例会（令和X年M月D日開催）[PDFファイル／XXX KB]
</a>

<h3>臨時会</h3>
<a href="/uploaded/life/{ページID}_{ファイルID}_misc.pdf">
  第X回鬼北町議会臨時会（令和X年M月D日開催）[PDFファイル／XXX KB]
</a>
```

---

## PDF URL パターン

```
/uploaded/life/{ページID}_{ファイルID}_misc.pdf
```

- `{ページID}`: 年度別インデックスページの ID と一致する数値（例: `30128`）
- `{ファイルID}`: ファイルごとに割り当てられた連番（例: `63551`）
- サフィックス: 常に `_misc.pdf` で固定

例:
```
/uploaded/life/32898_63551_misc.pdf  （令和7年 第1回定例会 3月5日）
/uploaded/life/30127_58166_misc.pdf  （令和6年 第1回定例会 3月7日）
/uploaded/life/14360_32858_misc.pdf  （平成31年 第1回定例会 3月6日）
```

---

## リンクテキストのフォーマット

```
第X回鬼北町議会[定例会|臨時会]（令和X年M月D日開催）[PDFファイル／XXX KB]
```

抽出できる情報:
- 回次: `第X回`
- 会議種別: `定例会` または `臨時会`
- 開催日: `令和X年M月D日`（和暦）

---

## 会議種別

| 種別 | 開催頻度 |
| --- | --- |
| 定例会 | 年3〜4回（第1〜4回） |
| 臨時会 | 不定期（年1〜4回程度） |

---

## スクレイピング戦略

### Step 1: 年度別インデックスページ URL の収集

年度一覧ページ `list17-364.html` から、年度別インデックスページへのリンク（`/site/gikai/{ページID}.html`）を抽出する。

- 取得対象: `href` が `/site/gikai/` で始まり、数値 ID のみのリンク
- 年度一覧ページにページネーションはないため、1リクエストで全年度を取得できる

### Step 2: 各年度インデックスページの PDF リンク収集

各年度インデックスページから、PDF へのリンク（`/uploaded/life/...misc.pdf`）とリンクテキストを抽出する。

- `<h3>` の直後のセクションで会議種別（定例会・臨時会）を判定する
- リンクテキストから開催日・回次・会議種別を正規表現で抽出する
- ページネーションはないため、1リクエストで全 PDF リンクを取得できる

**抽出用正規表現（案）:**

```typescript
// 会議録リンクテキストのパース
const titlePattern = /第(\d+)回鬼北町議会(定例会|臨時会)（(令和|平成)(\d+)年(\d+)月(\d+)日開催）/;

// PDFリンクのフィルタリング
const pdfPattern = /^\/uploaded\/life\/.+_misc\.pdf$/;
```

### Step 3: PDF の取得とテキスト抽出

収集した PDF URL から直接ダウンロードし、テキストを抽出する。

- 各 PDF は 1 日分の会議録に対応
- PDF サイズは概ね 200KB〜1MB 程度

---

## 注意事項

- 平成31年と令和元年は同一年度として1ページにまとめられている
- 年度インデックスページの `{ページID}` と PDF URL 内の `{ページID}` は必ずしも一致しない（令和7年のインデックスは `30128` だが PDF の `{ページID}` は `32898`）
- 新しい会議録が追加されると年度インデックスページが更新されるため、差分取得には最終更新日時を利用する

---

## 推奨アプローチ

1. **2段階クロール**: 年度一覧 → 各年度インデックス → PDF の順でクロールする
2. **PDF 直接取得**: HTML の中間ページは存在せず、PDF へ直リンクされているためシンプルに取得可能
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 年度一覧ページの更新日付（例: `2025年3月7日更新`）を監視し、更新があった年度のみ再取得する
