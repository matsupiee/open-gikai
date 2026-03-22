# 白馬村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.hakuba.lg.jp/gyosei/gyoseijoho/hakubamuragikai/1871.html
- 分類: 自治体 CMS（SMART CMS）による単一ページ + PDF 公開
- 文字コード: UTF-8
- 特記: 会議録は全て PDF ファイルで公開（2010年〜2025年）。検索システムなし、単一ページに全年度の PDF リンクが掲載されている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧ページ | `https://www.vill.hakuba.lg.jp/gyosei/gyoseijoho/hakubamuragikai/1871.html` |
| PDF ファイル | `https://www.vill.hakuba.lg.jp/material/files/group/14/{ファイル名}.pdf` |

PDF ファイルは全て `/material/files/group/14/` 配下に格納されている。

---

## ページ構造

単一の HTML ページに、年度ごとの `<h2>` 見出しと `<table>` で定例会・臨時会の PDF リンクが掲載されている。

### 年度見出し

```html
<h2 class="head-title" id="h_idx_iw_flex_1_0">
  <span class="bg"><span class="bg2">令和7年（2025年）</span></span>
</h2>
```

- `h_idx_iw_flex_1_0`（2025年）〜 `h_idx_iw_flex_1_15`（2010年）の 16 年分

### テーブル構造

各年度の `<h2>` の直後に `<div class="wysiwyg">` があり、その中に `<table>` が含まれる。

```html
<table border="1" cellpadding="1" cellspacing="1" style="width:100%;">
  <tbody>
    <tr>
      <td style="text-align: center;">定例会</td>
      <td style="text-align: center;">臨時会</td>
    </tr>
    <tr>
      <td style="text-align: center;">
        <a target="_blank" class="icon2" href="//www.vill.hakuba.lg.jp/material/files/group/14/R7dai1teireikai_kaigiroku.pdf">
          第1回(PDFファイル:922.1KB)
        </a>
      </td>
      <td style="text-align: center;">
        <a target="_blank" class="icon2" href="//www.vill.hakuba.lg.jp/material/files/group/14/R7dai1rinjikai_kaigiroku.pdf">
          第1回(PDFファイル:370.5KB)
        </a>
      </td>
    </tr>
  </tbody>
</table>
```

- 1 行目はヘッダー行（「定例会」「臨時会」）
- 2 行目以降に各回の PDF リンクが配置される
- 左列が定例会、右列が臨時会
- 臨時会がない行は `&nbsp;` が入る

---

## PDF ファイル名の命名規則

ファイル名の命名規則は年度によって大きく異なり、統一されていない。

### 近年（令和4年〜令和7年）

```
R7dai1teireikai_kaigiroku.pdf    → 令和7年 第1回 定例会
R7dai1rinjikai_kaigiroku.pdf     → 令和7年 第1回 臨時会
R6dai3teireikai_gijiroku.pdf     → 令和6年 第3回 定例会（「gijiroku」表記もあり）
```

パターン: `R{年}dai{回}{teireikai|rinjikai}_{kaigiroku|gijiroku}.pdf`

### 令和5年

```
R5dai1teireikaikaigiroku.pdf     → アンダースコアなし
R5dai1rinnjikaikaigiroku.pdf     → 「rinnjikai」（n が2つ）
```

### 令和2年〜令和4年

```
R4-1teireikaigijiroku.pdf        → ハイフン区切り
R3-2teireikaigijiroku.pdf
reiwa2dai1teirei.pdf             → 「reiwa」表記
R2-3teiriekaigijiroku.pdf        → typo あり（「teirie」）
```

### 平成31年・令和元年

```
h31hakuba1tei.pdf                → 「h31」+「hakuba」+回+「tei」
r-1hakuba2tei.pdf                → 「r-1」（令和元年）
motonenrinji.pdf                 → 「元年臨時」
```

### 平成29年〜平成30年

```
gikaiheisei30-1.pdf
h302teireikai.pdf
H30rinjikai_kaigiroku.pdf
h29dai1teireikaikaigiroku.pdf
```

### 古い年度（平成22年〜平成28年）

```
1003_teirei.pdf                  → YYMM_teirei 形式
1005_rinji.pdf                   → YYMM_rinji 形式
1303_teirei.pdf
1602_ex.pdf                      → ex = 臨時会?
H22rinnjikai1_kaigiroku.pdf      → H22 形式も混在
```

---

## ページネーション

なし。全年度の会議録リンクが 1 ページに掲載されている。

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

会議録一覧ページ（`1871.html`）から全ての PDF リンクを収集する。

**収集方法:**

1. `https://www.vill.hakuba.lg.jp/gyosei/gyoseijoho/hakubamuragikai/1871.html` を取得
2. Cheerio で `<h2>` の年度見出しと、直後の `<table>` 内の `<a>` タグを対応付けて抽出
3. `href` 属性から PDF URL を取得（プロトコル相対 URL `//www.vill.hakuba.lg.jp/...` なので `https:` を付与）
4. リンクテキスト（例: `第1回(PDFファイル:922.1KB)`）から定例会の回数を抽出
5. テーブルの列位置（左=定例会、右=臨時会）から会議種別を判定

**抽出ロジック:**

```typescript
// 年度見出しの取得
const yearPattern = /(?:令和|平成\d+年・令和元年|平成)(\S+?)年（(\d{4})年）/;

// テーブルの各行から PDF リンクを抽出
// 列インデックス 0 = 定例会, 1 = 臨時会
// リンクテキストから回数を抽出
const sessionPattern = /第(\d+)回/;
```

### Step 2: PDF のダウンロードとテキスト抽出

1. 収集した PDF URL をダウンロード
2. PDF パーサー（pdf-parse 等）でテキストを抽出
3. メタ情報（年度、回数、会議種別）は Step 1 で HTML から取得済みのものを使用

### Step 3: テキストのパース

PDF から抽出したテキストの構造は PDF の作成方法に依存するため、実際の PDF を確認して発言者パターン等を特定する必要がある。

---

## 注意事項

- PDF ファイル名の命名規則が年度によって大きく異なるため、ファイル名からメタ情報を抽出するのは困難。HTML のテーブル構造から年度・回数・会議種別を取得するべき
- PDF リンクの `href` はプロトコル相対 URL（`//www.vill.hakuba.lg.jp/...`）で記載されているため、`https:` を付与する必要がある
- 合計 104 件の PDF リンクが存在（2025年3月時点）
- 一部のファイル名に typo がある（例: `teiriekaigijiroku`、`rinnjikai`）
- canonical URL は `/gyosei/soshikikarasagasu/gikaijimukyoku/hakubamuragikai/732.html` だが、実際のアクセス URL と内容は同一

---

## 推奨アプローチ

1. **単一ページ取得**: 1 回の HTTP リクエストで全年度の PDF リンクを取得可能
2. **HTML 構造からメタ情報を取得**: ファイル名の命名規則が不統一なため、`<h2>` の年度見出しとテーブルの列位置から年度・会議種別を判定する
3. **レート制限**: PDF ダウンロード時はリクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: HTML ページの PDF リンク数を前回取得時と比較し、新規リンクのみをダウンロードする
