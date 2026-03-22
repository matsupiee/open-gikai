# 生坂村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.village.ikusaka.nagano.jp/gikai/teireikai.html
- 分類: 自治体公式サイト上で定例会・臨時会ごとに PDF を公開（既存アダプターでは対応不可）
- 形式: PDF ファイル
- 文字コード: UTF-8
- 特記: 会議録検索システムなし。静的 HTML ページに PDF リンクを掲載。JustSystems Homepage Builder で構築

---

## サイト構造

### 議会トップページ

`https://www.village.ikusaka.nagano.jp/gikai/` から以下のナビゲーションで遷移可能。

| ページ | URL |
| --- | --- |
| HOME | `index.html` |
| 議員紹介 | `giin_syoukai.html` |
| 議員構成 | `giin_kousei.html` |
| 議会組織 | `sosiki.html` |
| 定例会・臨時会 | `teireikai.html` |
| YouTube | `https://www.youtube.com/channel/UCiP7xSvGaq9jOpvZrrT_SAQ` |

### 定例会・臨時会ページ（メインターゲット）

`https://www.village.ikusaka.nagano.jp/gikai/teireikai.html`

1 ページに全年度の会議録 PDF リンクがまとめて掲載されている。ページネーションなし。

---

## URL 構造

### 会議録 PDF

```
https://www.village.ikusaka.nagano.jp/gikai/gijiroku/teireikai{和暦年2桁}.{月2桁}.pdf
```

ファイル名の命名規則:

| パターン | 例 | 対応する会議 |
| --- | --- | --- |
| `teireikai{YY}.{MM}.pdf` | `teireikai07.06.pdf` | 令和7年6月定例会 |
| `teireikai{YY}.{MM}.pdf` | `teireikai07.01.pdf` | 令和7年1月臨時会 |
| `teireikai{YY}.{M}.pdf` | `teireikai03.9.pdf` | 令和3年9月定例会 |
| `teireikai{YY}.{M}.pdf` | `teireikai01.5.pdf` | 令和元年5月臨時会 |
| `teireikai31.{M}.pdf` | `teireikai31.3.pdf` | 平成31年3月定例会 |

**注意: ファイル名に不統一がある**

- 月の桁数が統一されていない（`06` と `6` が混在）
- 令和6年9月定例会は `teireikai06..09.pdf`（ドットが2つ）という誤記がある
- 令和5年3月定例会は `teireikai0503 .pdf`（スペースが含まれる）という誤記がある
- URL に規則性が完全には保証されないため、HTML ページからリンクを収集する方が確実

---

## ページ構造

### teireikai.html の HTML 構造

年度ごとに `<h3>` 見出しで区切られ、その下に各会議の PDF リンクが並ぶ。

#### 令和3年〜現在（新しい形式）

```html
<h3 id="link01">令和7年</h3>
<div class="mol_attachfileblock">
  <p class="mol_attachfileblock_title"><strong>6月定例会</strong></p>
  <ul>
    <li>
      <img src="images/pdf_icon.png" class="icon">
      <a href="gijiroku/teireikai07.06.pdf" target="_blank"> 会議録</a>
    </li>
  </ul>
</div>
```

- `<h3>` で年度（「令和7年」「令和6年」...）
- `div.mol_attachfileblock` で各会議をブロック化
- `p.mol_attachfileblock_title > strong` に会議名（「6月定例会」「8月臨時会」等）
- `<a>` タグの `href` に PDF の相対パス

#### 令和2年以前（旧形式）

```html
<h3 id="link01">令和2年</h3>
<table id="plan">
  <tbody>
    <tr>
      <td><a href="gijiroku/teireikai02.01.pdf" target="_blank">1月臨時会</a></td>
      <td><a href="gijiroku/teireikai02.03.pdf" target="_blank">3月定例会</a></td>
      <td><a href="gijiroku/teireikai02.06.pdf" target="_blank">6月定例会</a></td>
    </tr>
  </tbody>
</table>
```

- テーブル形式で 3 列ずつリンクが並ぶ
- `<a>` タグのリンクテキストに会議名（「3月定例会」等）が直接記載

### YouTube 動画リンク

令和3年の一部の定例会には一般質問の YouTube 動画リンクが含まれる。

```html
<li>
  <img src="images/movie_icon.png" class="icon">
  <a href="https://youtu.be/..." target="_blank">藤澤幸恵議員 一般質問</a>
</li>
```

---

## 会議の種類

| 種類 | 開催月の傾向 |
| --- | --- |
| 定例会 | 3月、6月、9月、12月 |
| 臨時会 | 1月、2月、5月、7月、8月、10月、11月（不定期） |

対象範囲: 平成31年（2019年）〜現在

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

`teireikai.html` の 1 ページから全ての PDF リンクを収集する。

**収集方法:**

1. `https://www.village.ikusaka.nagano.jp/gikai/teireikai.html` を取得
2. 全ての `<a>` タグから `href` に `gijiroku/` を含み `.pdf` で終わるリンクを抽出
3. `<h3>` 見出しから年度情報を取得
4. 新形式: `p.mol_attachfileblock_title > strong` から会議名を取得
5. 旧形式: `<a>` タグのリンクテキストから会議名を取得
6. 相対パスを絶対 URL に変換

**収集するメタ情報:**

```typescript
interface IkusakaMinutes {
  year: string;       // "令和7年" など
  session: string;    // "6月定例会" | "8月臨時会" など
  pdfUrl: string;     // PDF の絶対 URL
}
```

### Step 2: PDF のダウンロードとテキスト抽出

1. 収集した PDF URL からファイルをダウンロード
2. PDF パーサー（pdf-parse 等）でテキストを抽出
3. 抽出したテキストから発言者・発言内容をパース

### Step 3: テキストのパース（推定）

PDF 内のテキスト構造は一般的な議会会議録形式と推定される。

- 開催日・会議名はヘッダー部分に記載
- 発言者は「○議長」「○N番」等の形式で記載される可能性がある
- PDF のレイアウトに依存するため、実際のファイルを確認して正規表現を調整する必要あり

---

## 注意事項

- PDF 形式のため、HTML スクレイピングとは異なり PDF パーサーが必要
- PDF のレイアウト（段組み・ヘッダー/フッター等）によってテキスト抽出の精度が変わるため、実際の PDF を確認してパーサーの調整が必要
- ファイル名に不統一・誤記があるため（ドット2つ、スペース混入）、URL を手動構築せず HTML からリンクを収集すること
- 令和3年以降と令和2年以前で HTML 構造が異なる（div 形式 vs table 形式）ため、両方のパーサーが必要
- `gijiroku/` ディレクトリへの直接アクセスは 403 Forbidden となるため、必ず `teireikai.html` を起点にする

---

## 推奨アプローチ

1. **単一ページクロール**: `teireikai.html` の 1 ページに全データが集約されているため、クロールは 1 リクエストで完了する
2. **PDF テキスト抽出の事前検証**: 数件の PDF を手動でダウンロードし、テキスト抽出の品質を確認する。段組み・文字化け等の問題がないか事前に検証
3. **レート制限**: PDF ダウンロード時に自治体サイトへの負荷を考慮し、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 前回取得済みの PDF URL リストと比較し、新規追加分のみダウンロードする
5. **URL エンコード**: ファイル名にスペースが含まれるケースがあるため、URL エンコードを適切に処理する
