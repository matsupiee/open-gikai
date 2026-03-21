# 芦北町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.ashikita.lg.jp/
- 分類: 町公式サイトで PDF を直接公開（外部の専用検索システムは使用していない）
- 文字コード: UTF-8
- 特記: PDF ダウンロードリンクは `/resource.php?e=[ハッシュ値]` 形式で難読化されている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/` |
| 年度別インデックス | `https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/{年号}_kaigiroku/` |
| 年度別会議録一覧 | `https://www.town.ashikita.lg.jp/chosei/gikai/gikairoku/{年号}_kaigiroku/{数値ID}` |
| PDF ダウンロード | `https://www.town.ashikita.lg.jp/resource.php?e={ハッシュ値}` |

### 年号のパターン

令和は `r` + 数字、平成は `h` + 数字で表記される。

| 年度 | URL 内の年号表記 |
| --- | --- |
| 令和7年 | `r7` |
| 令和6年 | `r6` |
| 令和5年 | `r5` |
| 令和4年 | `r4` |
| 令和3年 | `r3` |
| 令和2年 | `r2` |
| 令和元年 | `r1` |
| 平成30年 | `h30` |
| 平成29年 | `h29` |
| ... | ... |
| 平成22年 | `h22` |

---

## ページ構造

### 会議録トップページ

会議録トップ (`/chosei/gikai/gikairoku/`) には年度別のリンクが並ぶ。各リンクは年度別インデックスページへ遷移する。

### 年度別インデックスページ

年度別インデックスページ（例: `/chosei/gikai/gikairoku/r6_kaigiroku/`）には、当該年度の会議録一覧ページへのリンクが 1 件掲載されている（例: `/chosei/gikai/gikairoku/r6_kaigiroku/2064796`）。

### 年度別会議録一覧ページ

年度別会議録一覧ページに PDF リンクが一覧表示される。構造の例:

```html
<h1>令和6年 議会会議録</h1>
<!-- 各会議録の PDF ダウンロードリンク -->
<a href="/resource.php?e=56437ba5be12b4df37e12db8e87273f80945f5d5b2ba2c08e80ae77bbe710d03b0f26046d96f01b2621232cfd487f824">
  令和6年第2回定例会会議録 (PDF 1010KB)
</a>
```

- PDF リンクのテキストに会議名とファイルサイズが含まれる
- 同一ページで当該年度の全会議録 PDF が一覧できる

---

## 掲載年度範囲

平成22年（2010年）〜 令和7年（2025年）

---

## 会議種別

定例会と臨時会が掲載されている。平成22年の例では 7 回（定例会 4 回・臨時会 3 回）が確認されている。

| 種別 | 備考 |
| --- | --- |
| 定例会 | 年4回が標準 |
| 臨時会 | 年によって回数が異なる |

委員会別の会議録は掲載されていない。すべて本会議（定例会・臨時会）のみ。

---

## PDF ダウンロード URL の特徴

PDF のダウンロード URL は `/resource.php?e={ハッシュ値}` 形式で、ファイル名が URL に含まれない。

- ハッシュ値は推測不可能なため、**必ず HTML から `<a href>` を抽出して URL を収集する**
- 直接 PDF URL を構築することはできない

---

## スクレイピング戦略

### Step 1: 年度別会議録一覧ページの URL を収集

会議録トップ (`/chosei/gikai/gikairoku/`) を取得し、年度別インデックスページへのリンクを抽出する。

```typescript
// 年度別インデックスリンクの抽出例
const yearLinks = $('a[href*="_kaigiroku"]')
  .map((_, el) => new URL($(el).attr('href')!, BASE_URL).toString())
  .toArray();
```

### Step 2: 年度別インデックスページから会議録一覧ページの URL を取得

各年度別インデックスページ（例: `/chosei/gikai/gikairoku/r6_kaigiroku/`）を取得し、数値 ID のリンクを抽出する。

```typescript
// 年度別会議録一覧ページへのリンク抽出例
const listPageUrl = $(`a[href*="${yearSlug}/"]`)
  .filter((_, el) => /\/\d+$/.test($(el).attr('href')!))
  .first()
  .attr('href');
```

### Step 3: 年度別会議録一覧ページから PDF URL を収集

年度別会議録一覧ページ（例: `/chosei/gikai/gikairoku/r6_kaigiroku/2064796`）を取得し、`/resource.php?e=` を含む `<a href>` をすべて抽出する。

```typescript
// PDF リンクの抽出例
const pdfLinks = $('a[href*="/resource.php?e="]')
  .map((_, el) => ({
    url: new URL($(el).attr('href')!, BASE_URL).toString(),
    label: $(el).text().trim(),
  }))
  .toArray();
```

### Step 4: 会議メタ情報の抽出

`<a>` テキストから会議名と種別を抽出する。

**テキスト例:**
- `令和6年第1回定例会会議録 (PDF 3528KB)`
- `平成22年第2回臨時会会議録 (PDF 518KB)`

```typescript
// 会議名から年度・回次・種別を抽出
const sessionPattern = /(?:令和|平成)(\d+)年第(\d+)回(定例会|臨時会)/;
// 例: "令和6年第1回定例会会議録" → year=6, count=1, type="定例会"
```

### Step 5: 各 PDF を取得・テキスト抽出

PDF ファイルを取得し、テキスト抽出ツール（pdf-parse 等）でテキスト化する。

---

## 注意事項

- **PDF URL の難読化**: `/resource.php?e=` 形式のため URL からファイル名・メタ情報を推測できない。必ず HTML から収集する
- **3 階層構造**: トップ → 年度別インデックス → 年度別会議録一覧 の 3 段階のナビゲーションが必要
- **年度別インデックスに中間ページあり**: 年度別インデックスページと実際の一覧ページが分かれているため、2 回のリクエストが必要
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **全年度を網羅**: トップページから全年度のインデックス URL を収集し、各年度の会議録一覧ページへアクセスする
2. **リンクから直接収集**: PDF URL は HTML の `<a href>` から取得し、URL を推測・構築しない
3. **テキストからメタ情報取得**: リンクテキストに年度・回次・種別が含まれるため、正規表現で抽出する
4. **差分更新**: 既取得 URL のリストと比較し、新規 URL のみ PDF を取得する
5. **レート制限**: 各リクエスト間に 1〜2 秒の待機を設ける
