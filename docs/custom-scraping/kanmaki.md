# 上牧町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kanmaki.nara.jp/soshiki/gikaijimu/gyomu/gikai/about_gikai/353.html
- 分類: 自治体公式サイト上で PDF 文書を年度別に公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は全て PDF 形式で公開。HTML の会議録検索システムは存在しない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧ページ | `https://www.town.kanmaki.nara.jp/soshiki/gikaijimu/gyomu/gikai/about_gikai/353.html` |
| 会議録 PDF | `https://www.town.kanmaki.nara.jp/material/files/group/17/{ファイル名}.pdf` |

### 一覧ページの特徴

- 単一の HTML ページに「提出議案など」「会議録」「議会だより」の 3 セクションがまとめて掲載
- ページネーションなし（全件が 1 ページに表示）
- 会議録セクションは `<h2>会議録</h2>` の直後に `<p><a href="...">` のリストが並ぶシンプルな構造

---

## PDF リンクの構造

### HTML 構造

```html
<h2>会議録</h2>
<p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_rinnji_kaigiroku.pdf">
  令和7年_第4回（12月）上牧町臨時会会議録 (PDFファイル: 263.3KB)
</a></p>
<p><a href="//www.town.kanmaki.nara.jp/material/files/group/17/R07_12_teirei_kaigiroku.pdf">
  令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
</a></p>
<!-- ... 以下同様 -->
```

- `href` はプロトコル相対 URL（`//www.town.kanmaki.nara.jp/...`）
- リンクテキストに年度、回数、月、会議種別、ファイルサイズが含まれる

### ファイル名の命名規則

ファイル名に一貫した命名規則はない。年度・時期によって以下のパターンが混在する:

| 時期 | ファイル名パターン | 例 |
| --- | --- | --- |
| 令和7年〜令和4年 | `R{年}_{ 月}_{ 種別}_kaigiroku.pdf` or `_roku.pdf` | `R07_12_teirei_kaigiroku.pdf`, `R4_1_teirei_roku.pdf` |
| 令和6年（一部） | `R6{月}{種別}_kaigiroku.pdf` | `R609teirei_kaigiroku.pdf` |
| 令和5年 | `R5_{月}kaigiroku.pdf` or `R5_{月}{種別}_roku.pdf` | `R5_12kaigiroku.pdf`, `R5_06teire_roku.pdf` |
| 令和3年以前 | ハッシュ値（MD5） | `46831fd8a822678718b2cbd9cad377f8.pdf` |

---

## 会議録のメタ情報

### リンクテキストからの抽出

リンクテキストの形式:

```
令和7年_第4回（12月）上牧町臨時会会議録 (PDFファイル: 263.3KB)
令和7年第4回（12月）上牧町定例会会議録 (PDFファイル: 2.6MB)
令和6年_第3回（9月）上牧町議会定例会会議録 (PDFファイル: 5.1MB)
```

- 年度: `令和X年` / `平成31年`
- 回数: `第N回`
- 開催月: `（N月）`
- 会議種別: `定例会` / `臨時会`
- 表記ゆれ: `上牧町定例会` と `上牧町議会定例会` が混在（令和7年以降は「議会」なし、令和6年以前は「議会」あり）
- アンダースコアの有無も不統一（`令和7年_第4回` vs `令和7年第4回`）

### パース用正規表現（案）

```typescript
// リンクテキストからメタ情報を抽出
const metaPattern = /^((?:令和|平成)\d+年)_?第(\d+)回（(\d+)月）上牧町(?:議会)?(定例会|臨時会)会議録/;
// グループ: [1]=年度, [2]=回数, [3]=月, [4]=会議種別

// ファイルサイズの抽出
const sizePattern = /\(PDFファイル:\s*([\d.]+(?:KB|MB))\)/;
```

### 会議の種類

| 種別 | 頻度 |
| --- | --- |
| 定例会（teirei） | 年4回（3月・6月・9月・12月） |
| 臨時会（rinji） | 不定期（年1〜4回程度） |

---

## 収録範囲

- 最新: 令和7年（2025年）第4回 12月
- 最古: 平成31年（2019年）第1回 3月
- 合計: 約 43 件の会議録 PDF

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF リンクを収集

一覧ページ `353.html` をフェッチし、`<h2>会議録</h2>` セクション内の全 `<a>` タグを抽出する。

**収集方法:**

1. `353.html` を取得
2. `<h2>会議録</h2>` と次の `<h2>` の間の HTML を抽出
3. `<a href="...pdf">` を Cheerio で取得し、href とリンクテキストを収集
4. href のプロトコル相対 URL を `https:` に補完

```typescript
// Cheerio での抽出例
const $ = cheerio.load(html);
const links: { url: string; text: string }[] = [];

// h2:contains("会議録") の次の兄弟要素から次の h2 までを走査
let current = $('h2:contains("会議録")').next();
while (current.length && !current.is('h2')) {
  const anchor = current.find('a[href$=".pdf"]');
  if (anchor.length) {
    const href = anchor.attr('href');
    const text = anchor.text().trim();
    if (href) {
      links.push({
        url: href.startsWith('//') ? `https:${href}` : href,
        text,
      });
    }
  }
  current = current.next();
}
```

### Step 2: リンクテキストからメタ情報を抽出

各リンクテキストを正規表現でパースし、年度・回数・月・会議種別を取得する。

```typescript
interface KanmakiMinutes {
  url: string;
  year: string;       // "令和7年" など
  sessionNumber: number; // 第N回の N
  month: number;       // 開催月
  sessionType: '定例会' | '臨時会';
  fileSize: string;    // "2.6MB" など
}
```

### Step 3: PDF のダウンロードとテキスト抽出

- PDF をダウンロードし、`pdf-parse` 等のライブラリでテキストを抽出
- PDF 内部の構造は文書ごとに異なる可能性があるため、テキスト抽出後のパースは柔軟に対応する必要がある

---

## 注意事項

- PDF ファイルのサイズが大きいものがある（最大 7.3MB）。ダウンロード時にタイムアウトに注意
- ファイル名の命名規則が統一されていないため、ファイル名からのメタ情報抽出は不可。リンクテキストをメタ情報のソースとして使用する
- 令和3年以前のファイル名はハッシュ値のため、URL からは内容を推測できない
- 一覧ページの構造がシンプル（`<p><a>` の繰り返し）なため、CMS の更新でマークアップが変わる可能性に備えて、PDF リンクの抽出ロジックは堅牢にする
- 「会議録」セクション以外にも PDF リンクがあるため（提出議案、議会だより）、セクションの特定が重要

---

## 推奨アプローチ

1. **一覧ページからの全量取得**: 単一ページに全件掲載されているため、1 回のリクエストで全 PDF リンクを取得可能
2. **リンクテキストベースのメタ情報抽出**: ファイル名ではなくリンクテキストからメタ情報をパースする
3. **PDF テキスト抽出**: `pdf-parse` や `pdf2json` でテキストを抽出し、発言内容をパースする
4. **レート制限**: PDF ダウンロード時はリクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 一覧ページの PDF リンク数を前回取得時と比較し、新規追加分のみダウンロードする
