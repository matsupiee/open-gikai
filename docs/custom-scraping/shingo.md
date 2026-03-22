# 新郷村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.shingo.aomori.jp/page-25971/
- 分類: WordPress ベースの村公式サイト。会議録を PDF ファイルで公開
- 文字コード: UTF-8

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.vill.shingo.aomori.jp/page-25971/` |
| 令和8年会議録 | `https://www.vill.shingo.aomori.jp/page-30802/` |
| 令和7年会議録 | `https://www.vill.shingo.aomori.jp/page-28901/` |
| 令和6年会議録 | `https://www.vill.shingo.aomori.jp/page-25971/page-27906/` |
| 令和5年会議録 | `https://www.vill.shingo.aomori.jp/page-27086/` |
| 令和4年会議録 | `https://www.vill.shingo.aomori.jp/page-25973/` |
| 令和3年会議録 | `https://www.vill.shingo.aomori.jp/public/ogani/sosiki/page-22130/page-22054/page-22134/` |
| PDF ファイル | `https://www.vill.shingo.aomori.jp/common/media/{YYYY}/{MM}/{hash}.pdf` |

- 年度ごとのページ URL に規則性はない（WordPress の page ID ベース）
- PDF の URL は `/common/media/{年}/{月}/{ハッシュ値}.pdf` のパターン
- 令和3年の PDF のみファイル名が人間可読（例: `R3No1_teirei.pdf`）、令和4年以降はハッシュ値

## HTML 構造

### 会議録一覧ページ（トップ）

年度ごとの会議録ページへのリンクが `<h6><a>` タグで列挙されている。

```html
<div id="cont">
  <h2>会議録</h2>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-30802/">令和8年会議録</a></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-28901/">令和7年会議録</a></h6>
  <h6><a href="https://www.vill.shingo.aomori.jp/page-25971/page-27906/">令和6年会議録</a></h6>
  <!-- ... -->
</div>
```

### 年度別ページ

各年度ページでは PDF リンクが `<p><a>` または `<li><a>` タグで列挙されている（年度によって HTML 構造が異なる）。

- 令和3年: `<p>` 内に `<a>` と `<br>` で列挙
- 令和4〜6年: `<p><a href="...pdf">タイトル（PDF）</a></p>` の繰り返し
- 令和7〜8年: `<li><a href="...pdf">タイトル</a></li>` のリスト形式

リンクテキストに会議名と日付が含まれる。

```
令和６年第１回定例会（令和６年３月１日～３月８日）（PDF）
令和7年第1回臨時会（令和7年1月23日）
令和4年第1回臨時会
```

- 日付の括弧書きがない場合もある（令和4年の一部）
- 全角・半角が混在する（年度により異なる）

## ページネーション

なし。各年度ページに当該年のすべての会議録 PDF リンクが一覧表示される。

## スクレイピング方針

### 2段階アプローチ

1. **一覧ページから年度別ページの URL を収集**
   - `https://www.vill.shingo.aomori.jp/page-25971/` の `#cont` 内の `h6 > a` を取得
   - リンクテキストに「会議録」を含むものをフィルタリング

2. **各年度ページから PDF リンクを収集**
   - 各年度ページの `#cont` 内から `.pdf` で終わる `<a>` タグの `href` を取得
   - リンクテキストから会議名（定例会/臨時会）と開催日を抽出
   - PDF をダウンロードしてテキスト抽出

### 会議情報の抽出

リンクテキストから以下の情報を正規表現で抽出する。

- 年号: `令和{N}年`
- 会議種別: `第{N}回定例会` / `第{N}回臨時会`
- 開催日: 括弧内の日付（存在する場合）

```
パターン例: /令和(\d+)年第(\d+)回(定例会|臨時会)(?:（(.+?)）)?/
```

### 注意事項

- 年度ごとのページ URL に規則性がないため、必ず一覧ページからリンクを辿る必要がある
- HTML のマークアップが年度により異なる（`<p>`, `<li>`, `<br>` 区切り）ため、PDF リンクは `.pdf` の href で一括取得する方が安定する
- サイドバーやフッターの画像リンクを除外するため、`#cont` セクション内に限定して抽出する
- PDF ファイルは1会議につき1ファイルにまとまっている
