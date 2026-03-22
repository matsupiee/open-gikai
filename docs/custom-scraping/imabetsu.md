# 今別町議会（青森県） カスタムスクレイピング方針

## 概要

- サイト: https://www.town.imabetsu.lg.jp/gyousei/gikai/
- 分類: 町公式サイトで「議会だより」を PDF として公開（会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録（議事録）そのものは公開されておらず、「議会だより」（議会広報誌）の PDF のみが提供されている。議会だよりには質疑応答の要約や議案の採決結果が含まれるが、逐語的な会議録ではない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.town.imabetsu.lg.jp/gyousei/gikai/` |
| 議会だより一覧 | `https://www.town.imabetsu.lg.jp/gyousei/gikai/dayori.html` |
| 議員組織 | `https://www.town.imabetsu.lg.jp/gyousei/gikai/soshiki.html` |
| 町議会のしくみ | `https://www.town.imabetsu.lg.jp/gyousei/gikai/tyogikai.html` |
| PDF ファイル | `https://www.town.imabetsu.lg.jp/gyousei/gikai/files/{ファイル名}.pdf` |

---

## 検索パラメータ

検索機能は存在しない。`dayori.html` の単一ページに全年度の議会だより PDF リンクが掲載されている。

---

## HTML 構造

### 議会だよりページ（dayori.html）

年ごとに `<h2>` 見出しで区切られ、その下に `<table>` で PDF リンクが並ぶ構造。

```html
<h2>2025年</h2>
<table cellpadding="1" cellspacing="1">
  <tbody>
    <tr>
      <td>
        <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank">222号</a></p>
        <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank">（２月３日発行）</a></p>
        <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank"><img alt="222" height="112" src="images/gikai222.jpg" width="80"></a></p>
        <p style="text-align: center;"><a href="files/gikai222.pdf" target="_blank"><span class="wcv_ww_filesize">(1760KB)</span></a></p>
      </td>
      <!-- 同年の他の号が <td> で横に並ぶ -->
    </tr>
  </tbody>
</table>
```

- 各年に1つの `<table>` があり、1行の `<tr>` 内に各号が `<td>` として横並び
- 各 `<td>` 内に号数、発行日、サムネイル画像、ファイルサイズが含まれる
- 年4回の発行（2月・5月・8月・11月頃）

### PDF ファイル名のパターン

ファイル名に統一的な命名規則はない:

- `gikai{号数}.pdf` (例: `gikai226.pdf`, `gikai222.pdf`)
- `{号数}.pdf` (例: `214.pdf`, `211.pdf`)
- `0{号数}.pdf` (例: `0183.pdf`, `0129.pdf`) - 古い号

---

## ページネーション

なし。全年度の議会だよりが `dayori.html` の単一ページに掲載されている。

---

## 掲載年度範囲

2002年度（129号）〜 2026年（226号）

---

## スクレイピング戦略

### Step 1: 議会だより一覧ページの取得

`dayori.html` を取得し、全 PDF リンクを収集する。

```typescript
const $ = cheerio.load(html);
const pdfLinks: { year: string; issue: string; date: string; url: string }[] = [];

$('h2').each((_, h2) => {
  const year = $(h2).text().trim(); // "2025年" など
  const table = $(h2).next('table');

  table.find('td').each((_, td) => {
    const links = $(td).find('a[href$=".pdf"]');
    if (links.length === 0) return;

    const href = links.first().attr('href'); // "files/gikai222.pdf"
    const issueText = links.first().text();  // "222号"
    // 発行日は2番目の <a> のテキストから取得
    const dateText = $(td).find('a').eq(1).text(); // "（２月３日発行）"

    pdfLinks.push({
      year,
      issue: issueText,
      date: dateText,
      url: `https://www.town.imabetsu.lg.jp/gyousei/gikai/${href}`,
    });
  });
});
```

### Step 2: PDF のダウンロードとテキスト抽出

1. 各 PDF をダウンロード
2. pdf-parse 等でテキストを抽出
3. 議会だよりの内容（質疑応答の要約、議案の採決結果等）をパース

### Step 3: メタ情報の抽出

PDF リンクのテキストから以下を抽出:

- **号数**: リンクテキスト（例: `222号`）
- **発行日**: リンクテキスト（例: `（２月３日発行）`）
- **年**: `<h2>` の見出しテキスト（例: `2025年`）

---

## 注意事項

- **議会だよりと会議録の違い**: 今別町が公開しているのは「議会だより」（議会広報誌）であり、逐語的な会議録（議事録）ではない。質疑応答は要約形式で掲載されており、発言の全文は含まれない
- **PDF ファイル名の不統一**: `gikai{号数}.pdf`、`{号数}.pdf`、`0{号数}.pdf` の3パターンが混在しており、ファイル名からの号数推測は困難。必ず HTML のリンクテキストから号数を取得する
- **全角数字**: 発行日の月日は全角数字で記載されている場合がある（例: `２月３日`）
- **空セル**: テーブル内に未発行号のための空セル（`&nbsp;` のみ）が含まれる。PDF リンクの有無で判定する
- **古い号のファイルサイズ表記**: 古い号では `<img alt="PDFファイル" class="wcv_ww_fileicon">` の PDF アイコン画像が含まれる

---

## 推奨アプローチ

1. **単一ページ起点**: `dayori.html` の1リクエストで全 PDF の URL を収集できる
2. **PDF テキスト抽出**: 議会だよりは PDF のみの提供のため、pdf-parse 等によるテキスト抽出が必須
3. **レート制限**: 自治体サイトのため、PDF ダウンロード時にリクエスト間 1〜2 秒の待機時間を設ける
4. **差分更新**: 既取得の号数リストと比較し、新規号のみを取得する
5. **内容の限界を認識**: 議会だよりは会議録の代替にはならないため、取得データの性質（要約・抜粋）をメタデータに記録する
