# 藍住町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.aizumi.lg.jp/gikai/minutes/
- 分類: 町公式サイト内での直接公開（会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で提供。年別の静的 HTML ページに定例会ごとの PDF リンクが列挙される。専用の検索システムは存在せず、キーワード検索機能もない。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年別リスト） | `https://www.town.aizumi.lg.jp/gikai/minutes/` |
| 年別会議録一覧（令和） | `https://www.town.aizumi.lg.jp/gikai/minutes/r{年号数字}.html` |
| 年別会議録一覧（平成） | `https://www.town.aizumi.lg.jp/gikai/minutes/h{年号数字}.html` |
| 会議録 PDF | `https://www.town.aizumi.lg.jp/_files/{ID}/{ファイル名}.pdf` |

### 年別ページ URL 一覧（確認済み）

| 年 | URL |
| --- | --- |
| 令和7年 | `/gikai/minutes/r7.html` |
| 令和6年 | `/gikai/minutes/r6.html` |
| 令和5年 | `/gikai/minutes/r5.html` |
| 令和4年 | `/gikai/minutes/r4.html` |
| 令和3年 | `/gikai/minutes/r3.html` |
| 令和2年 | `/gikai/minutes/r2.html` |
| 令和元年 | `/gikai/minutes/r1.html` |
| 平成30年 | `/gikai/minutes/h30.html` |
| 平成29年 | `/gikai/minutes/h29.html` |
| 平成28年 | `/gikai/minutes/h28.html` |
| 平成27年 | `/gikai/minutes/h27.html` |
| 平成26年 | `/gikai/minutes/h26.html` |
| 平成25年 | `/gikai/minutes/h25.html` |

- 対象期間: 平成25年〜令和7年（計13年分）
- ページネーションなし（1ページ完結）

---

## ページ構造

### 会議録トップページ（`/gikai/minutes/`）

- 年別リンクが `<ul><li><a>` 形式でリスト表示される
- 例: `<li><a href="/gikai/minutes/r7.html">令和7年</a></li>`
- メインコンテンツは `#main` アンカー配下

### 年別会議録一覧ページ

- 各定例会の会議録が `<a>` タグで直接リンクされる
- リンクテキスト形式: `令和X年第N回(月)定例会会議録[PDF：サイズ]`
- 例: `令和7年第4回(12月)定例会会議録[PDF：923KB]`
- 1年あたり4件の定例会（第1回〜第4回）が掲載される
- 臨時会・委員会の会議録は掲載なし

### PDF ファイル名の命名規則

`/_files/{数値ID}/{元号}{年号数字}_{回数}_kaigiroku.pdf` 形式

```
/_files/00654074/r7_4_kaigiroku.pdf  （令和7年第4回定例会）
/_files/00602051/R6_4__kaigiroku.pdf  （令和6年第4回定例会、大文字・アンダースコア2個）
/_files/00591287/r6_3_kaigiroku.pdf  （令和6年第3回定例会）
/_files/00041799/h25_4_kaigiroku.pdf  （平成25年第4回定例会）
```

- 元号部分の大文字・小文字が混在する（`r7` と `R6` など）
- 区切り文字のアンダースコア数が揺れる場合がある
- ファイル名の規則性は不安定なため、必ず HTML から `<a href>` を辿って URL を取得すること

---

## スクレイピング戦略

### Step 1: 年別ページ URL の収集

トップページ（`/gikai/minutes/`）から年別ページへのリンクを抽出する。

```typescript
// 年別ページリンクの抽出
const yearLinks = $('a[href*="/gikai/minutes/"]').filter((_, el) => {
  const href = $(el).attr('href') ?? '';
  return /\/gikai\/minutes\/[rh]\d+\.html$/.test(href);
});
```

または、URL パターンを直接生成する方法（トップページへのアクセスが不要な場合）:

```typescript
// 令和: r1〜r{現在の年号数字}
// 平成: h25〜h31
const reiwaUrls = Array.from({ length: currentReiwaYear }, (_, i) =>
  `https://www.town.aizumi.lg.jp/gikai/minutes/r${i + 1}.html`
);
const heiseiUrls = Array.from({ length: 7 }, (_, i) =>
  `https://www.town.aizumi.lg.jp/gikai/minutes/h${i + 25}.html`
);
```

### Step 2: 各年別ページからの PDF リンク収集

各年別ページにアクセスし、PDF へのリンクを抽出する。

```typescript
// PDF リンクの抽出
const pdfLinks = $('a[href$=".pdf"]');

pdfLinks.each((_, el) => {
  const href = $(el).attr('href');   // 例: /_files/00654074/r7_4_kaigiroku.pdf
  const text = $(el).text();         // 例: 令和7年第4回(12月)定例会会議録[PDF：923KB]
  const absoluteUrl = new URL(href, 'https://www.town.aizumi.lg.jp').toString();
});
```

**収集する情報:**
1. PDF の絶対 URL
2. リンクテキスト（会期名 + ファイルサイズ）
3. 年（ページの URL から取得）

### Step 3: メタ情報の抽出

リンクテキストから会期情報と開催月を抽出する。

```typescript
// 会期情報の抽出
const sessionPattern = /(令和|平成)(\d+)年(第(\d+)回)\((\d+)月\)(定例会|臨時会)/;
// 例: 令和7年第4回(12月)定例会会議録 → 令和7年・第4回・12月・定例会

// ファイルサイズの抽出（参考情報）
const sizePattern = /\[PDF：(.+?)\]/;
```

### Step 4: PDF のダウンロードとテキスト抽出

- PDF をダウンロードし、pdftotext 等でテキストを抽出する
- PDF がスキャン画像の場合は OCR が必要な可能性がある（事前に確認が必要）
- 発言者パターン等の詳細は PDF テキスト抽出後に分析する

---

## 注意事項

- PDF ファイルのファイル名命名規則が大文字・小文字やアンダースコア数の揺れがあるため、HTML から `<a href>` を辿って URL を取得すること（ファイル名を推測してアクセスしてはならない）
- 年別ページの URL パターン（`r{N}.html` / `h{N}.html`）は規則的だが、新年度追加時はトップページからリンクを取得する方が確実
- 臨時会・委員会の会議録は掲載されていない（定例会のみ）
- リクエスト間には適切な待機時間（1〜2秒）を設けること

---

## 推奨アプローチ

1. **トップページから年別 URL を収集**: `/gikai/minutes/` のリンクリストを取得し、年別ページの URL を一覧化する
2. **全年分を順次クロール**: 各年別ページにアクセスし、PDF リンクを収集する（ページネーションなしで1ページ完結）
3. **HTML からリンクを辿る**: PDF のファイル名命名規則が不安定なため、必ず HTML ページから `<a href>` を辿って PDF URL を取得する
4. **差分更新**: 年別ページ URL と PDF URL の組み合わせをキーとして管理し、取得済み URL を除いた差分のみを取得する
5. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2秒）を設ける
