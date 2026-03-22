# 立科町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/index.html
- 分類: 自治体 CMS（SMART CMS）による年度別 PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF ファイルで公開。2012年（平成24年）から現在まで。テキスト抽出が必要。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/index.html` |
| 年度別一覧 | `https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/{年度スラグ}/index.html` |
| 定例会ページ（PDF 一覧） | `https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/{年度スラグ}/{ページID}.html` |
| PDF ファイル | `https://www.town.tateshina.nagano.jp/material/files/group/{グループID}/{ファイル名}.pdf` |

### 年度スラグの例

| 年度 | スラグ |
| --- | --- |
| 令和7年 | `2335` |
| 令和6年 | `6` |
| 令和5年 | `r5gikai` |
| 令和4年 | `r4` |
| 令和3年 | `r3` |
| 令和2年 | `r2` |
| 令和元年（平成31年） | `h31` |
| 平成30年 | `h30` |
| 平成29年 | `h29` |
| 平成28年 | `h28` |
| 平成27年 | `h27` |
| 平成26年 | `h26` |
| 平成25年 | `h25` |
| 平成24年 | `h24` |

※ スラグに規則性がないため、トップページからリンクを動的に取得する必要がある。

---

## サイト構造

### 3 階層構成

1. **会議録トップ** - 年度のリンク一覧（`ul.level1col2` 内の `li.dir > a`）
2. **年度別一覧** - 定例会のリンク一覧（`ul.level1col2` 内の `li > a`、例: 「令和7年第1回」）
3. **定例会ページ** - 各日の会議録 PDF へのリンク一覧（`a.pdf` 要素）

### ページネーション

なし。各階層のリンクは 1 ページにすべて表示される。

---

## PDF ファイルの構造

### リンクテキストのパターン

PDF のリンクテキストには日付・会議内容・発言者名が含まれる。

```
3月4日本会議開会・町長招集挨拶・議案上程・提案説明 (PDFファイル: 711.8KB)
3月7日一般質問（森澤、中村、今井健児、小野沢、今井英昭、芝間） (PDFファイル: 727.9KB)
3月19日委員長報告・質疑・討論・採決 閉会 (PDFファイル: 698.3KB)
```

### PDF ファイル名のパターン

- 近年: `R7teireikai1-01.pdf`（年号＋定例会番号＋連番）
- 過去: `74284643.pdf`（数値ID、規則性なし）

### PDF の URL パターン

```
https://www.town.tateshina.nagano.jp/material/files/group/3/{ファイル名}.pdf   # 近年
https://www.town.tateshina.nagano.jp/material/files/group/8/{ファイル名}.pdf   # 過去
```

グループ ID は年度によって異なる（3 または 8 など）。HTML から直接取得する。

---

## スクレイピング戦略

### Step 1: 年度リンクの収集

会議録トップページ `kaigiroku/index.html` から全年度のリンクを取得する。

```typescript
// セレクタ: ul.level1col2 > li.dir > a
// 例: href="/gyoseijoho/gikai/kaigiroku/2335/index.html" → "令和7年"
const yearLinks = document.querySelectorAll("ul.level1col2 li.dir a");
```

### Step 2: 定例会リンクの収集

各年度ページから定例会ページのリンクを取得する。

```typescript
// セレクタ: ul.level1col2 > li > a
// 例: href="/gyoseijoho/gikai/kaigiroku/2335/2520.html" → "令和7年第1回"
const sessionLinks = document.querySelectorAll("ul.level1col2 li a");
```

### Step 3: PDF リンクの収集

各定例会ページから PDF ファイルのリンクとメタ情報を取得する。

```typescript
// セレクタ: a.pdf
// 例: href="//www.town.tateshina.nagano.jp/material/files/group/3/R7teireikai1-01.pdf"
//     text="3月4日本会議開会・町長招集挨拶・議案上程・提案説明 (PDFファイル: 711.8KB)"
const pdfLinks = document.querySelectorAll("a.pdf");
```

### Step 4: PDF のダウンロードとテキスト抽出

PDF をダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）を使用してテキストを抽出
- リンクテキストから日付・会議内容のメタ情報を取得

### メタ情報の抽出

#### 定例会ページの h1 タイトルから

```typescript
// h1.title のテキスト
// 例: "令和7年第1回" → 年度と回を抽出
const titlePattern = /^(令和|平成)\d+年第(\d+)回(定例会)?$/;
```

#### PDF リンクテキストから

```typescript
// リンクテキストから日付と内容を抽出
const linkPattern = /^(\d+)月(\d+)日(.+?)\s*\(PDFファイル/;
// 例: "3月4日本会議開会・町長招集挨拶・議案上程・提案説明 (PDFファイル: 711.8KB)"
//   → month=3, day=4, content="本会議開会・町長招集挨拶・議案上程・提案説明"
```

---

## 注意事項

- PDF のみで公開されているため、テキスト抽出の精度が HTML 公開型より低くなる可能性がある
- PDF 内の発言者パターンは PDF の内容に依存するため、実際の PDF を取得して確認する必要がある
- 年度スラグに規則性がないため、ハードコーディングせずトップページから動的にリンクを取得すること
- PDF の URL はプロトコル相対（`//www.town.tateshina.nagano.jp/...`）で記載されているため、`https:` を付与する必要がある
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **3 階層リンク走査**: トップ → 年度 → 定例会の順にリンクを辿り、全 PDF の URL を収集
2. **メタ情報はリンクテキストから取得**: PDF リンクのテキストに日付・内容が含まれているため、PDF を開く前にメタ情報を構造化できる
3. **PDF テキスト抽出**: pdf-parse 等を使い PDF からテキストを抽出。発言者パターンは実際の PDF を確認して決定する
4. **差分更新**: 年度ページの定例会リンク数を前回と比較し、新規追加分のみを取得する
5. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
