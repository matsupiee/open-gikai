# 六戸町議会 カスタムスクレイピング方針

## 概要
- サイト: https://www.town.rokunohe.aomori.jp/docs/2023051900005
- 分類: 自治体CMS（Joruri CMS）による単一ページPDF掲載型
- 文字コード: UTF-8

## URL 構造
| ページ | URL パターン |
| --- | --- |
| 会議録一覧（単一ページ） | `https://www.town.rokunohe.aomori.jp/docs/2023051900005` |
| PDF（新形式・R6以降） | `https://www.town.rokunohe.aomori.jp/docs/2023051900005/file_contents/{filename}.pdf` |
| PDF（旧形式・R5以前） | `https://www.town.rokunohe.aomori.jp/file/chousei/cyougikai/kaigiroku/{filename}.pdf` |

## HTML 構造

全会議録が1ページ内に年度別に掲載されている。年度見出しは `<h3>` タグで区切られる。

### 新形式（令和6年以降）

年度見出しの下に、定例会・臨時会名が `<ul><li>` で表示され、各PDF リンクは `<p>` タグ内の `<a class="iconFile iconPdf">` で記述される。

```html
<h3><strong>令和７年</strong></h3>
<ul>
  <li>第４回定例会［１２月］</li>
</ul>
<p>　・<a class="iconFile iconPdf" href="file_contents/071209.pdf">本会議3号（12月9日）[PDF：414KB]</a></p>
<p>　・<a class="iconFile iconPdf" href="file_contents/071208.pdf">本会議2号（12月8日）[PDF：610KB]</a></p>
```

- PDF の href は相対パス `file_contents/{filename}.pdf`
- ベースURL: `https://www.town.rokunohe.aomori.jp/docs/2023051900005/`

### 旧形式（令和5年以前）

定例会・臨時会名と PDF リンクがネストされた `<ul><li>` 構造になっている。PDF リンクは `<a>` タグで、別途 PDF アイコン画像が付く。

```html
<h3>令和５年</h3>
<ul>
  <li>第８回定例会［12月］
    <ul>
      <li><a class="iconFile iconPdf" href="file_contents/126.pdf">本会議３号（12月６日）[PDF：458KB]</a></li>
    </ul>
  </li>
  <li>第７回臨時会［10月］
    <ul>
      <li><a href="../../file/chousei/cyougikai/kaigiroku/R5-7rinnzihonkaigi1.pdf">本会議１号（10月19日）</a>
        <a href="..."><img alt="PDFアイコン" src="../../file/icon_pdf.gif" /></a>(PDF/134KB)</li>
    </ul>
  </li>
</ul>
```

- 一部は `file_contents/` 相対パス、一部は `../../file/chousei/cyougikai/kaigiroku/` 相対パス
- 旧形式では PDF アイコン画像のリンク先が実際の PDF とは異なる場合がある（ダミーリンク `1912190611.pdf`）ため、最初の `<a>` タグの href を取得すること

## ページネーション

なし。全会議録（平成24年以降）が単一ページに掲載されている。

## スクレイピング方針

1. 単一ページ `https://www.town.rokunohe.aomori.jp/docs/2023051900005` を取得
2. `<div class="body">` 内の `<h3>` タグで年度を判定（「令和７年」「令和６年」...「平成24年」）
3. 各年度セクション内の `<a>` タグから PDF リンクを収集
   - `href` が `.pdf` で終わるリンクを対象とする
   - `<img>` タグを含む PDF アイコン用のダミーリンク（`1912190611.pdf` など）は除外する
4. PDF の href を絶対 URL に変換
   - `file_contents/` で始まる場合: `https://www.town.rokunohe.aomori.jp/docs/2023051900005/file_contents/{filename}.pdf`
   - `../../file/` で始まる場合: `https://www.town.rokunohe.aomori.jp/file/chousei/cyougikai/kaigiroku/{filename}.pdf`
5. リンクテキストから会議種別（本会議、予算特別委員会、決算特別委員会）と日付を抽出
6. 直近の `<li>` の定例会・臨時会名（例:「第４回定例会［１２月］」）を会期情報として紐付け
7. PDF をダウンロードしてテキスト抽出を行う
