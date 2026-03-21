# 大洲市議会（愛媛県） カスタムスクレイピング方針

## 概要

- サイト: https://www.city.ozu.ehime.jp/kaigiroku/index.html
- 分類: 市独自ホスティングシステム（IBM WebSphere Studio 生成の静的 HTML）
- 文字コード: Shift-JIS（インデックスページ・古い HTML）/ UTF-8（平成20年以降の会議録 HTML）
- 特記: フレームセット構造。検索機能なし。年度別静的 HTML ファイルで管理。平成17〜18年のみ PDF 形式、平成19年以降は HTML 形式

---

## URL 構造

### フレーム構成

トップページはフレームセット構造になっており、2 つのフレームで構成される。

| フレーム | URL | 役割 |
| --- | --- | --- |
| top フレーム | `https://www.city.ozu.ehime.jp/kaigiroku/top.html` | 年度ナビゲーション（Shift-JIS） |
| bottom フレーム | `https://www.city.ozu.ehime.jp/kaigiroku/y{N}.html` | 各年度の会議一覧（Shift-JIS） |

### 年度インデックスページ

| ファイル名 | 対応年度 |
| --- | --- |
| `y26.html` | 令和8年（2026年） |
| `y25.html` | 令和7年（2025年） |
| `y24.html` | 令和6年（2024年） |
| `y23.html` | 令和5年（2023年） |
| `y22.html` | 令和4年（2022年） |
| `y21.html` | 令和3年（2021年） |
| `y20.html` | 令和2年（2020年） |
| `y19.html` | 平成31年/令和元年（2019年） |
| `y18.html` | 平成30年（2018年） |
| ... | ... |
| `y08.html` | 平成20年（2008年） |
| `y07.html` | 平成19年（2007年） |
| `y06.html` | 平成18年（2006年、PDF のみ） |
| `y05.html` | 平成17年（2005年、PDF のみ） |

年度インデックスは `top.html` のリンクから `y05.html`〜`y26.html`（現在）まで存在する。

### 会議録ファイルの URL パターン

#### 平成20年以降（HTML 形式）

| ページ | URL パターン |
| --- | --- |
| 年度一覧（Shift-JIS） | `https://www.city.ozu.ehime.jp/kaigiroku/y{N}.html` |
| 目次ページ（UTF-8） | `https://www.city.ozu.ehime.jp/kaigiroku/{年号ディレクトリ}/{YYYYMM}{会議種別}-mokuji.html` |
| 会議録本文（UTF-8） | `https://www.city.ozu.ehime.jp/kaigiroku/{年号ディレクトリ}/{YYYYMM}{会議種別}-{N}.html` |
| 付録（UTF-8） | `https://www.city.ozu.ehime.jp/kaigiroku/{年号ディレクトリ}/{YYYYMM}{会議種別}-huroku.html` |

**年号ディレクトリの例:**

- 令和8年: `R08/`
- 令和7年: `R07/`
- 令和2年: `R02/`
- 平成31年/令和元年: `R01/` または `H31/`（要確認）
- 平成30年: `H30/`
- 平成20年: `H20/`

**会議種別の例:**

- `teirei`: 定例会
- `rinji`: 臨時会

**具体的な URL 例:**

```
# 令和8年 第1回臨時会（1月）
目次: https://www.city.ozu.ehime.jp/kaigiroku/R08/202601rinji-mokuji.html
会議録第1号: https://www.city.ozu.ehime.jp/kaigiroku/R08/202601rinji-1.html
付録: https://www.city.ozu.ehime.jp/kaigiroku/R08/202601rinji-huroku.html

# 令和7年 第3回定例会（6月）
目次: https://www.city.ozu.ehime.jp/kaigiroku/R07/202506teirei-mokuji.html
会議録第1号: https://www.city.ozu.ehime.jp/kaigiroku/R07/202506teirei-1.html
```

#### 平成19年（HTML 形式、ディレクトリ構造が異なる）

URL にスペースが含まれる古い形式が使われている。

```
目次: https://www.city.ozu.ehime.jp/kaigiroku/07/01/070307%20teirei%20mokuji.html
会議録: https://www.city.ozu.ehime.jp/kaigiroku/07/01/070307%20teirei01.html
```

#### 平成17〜18年（PDF 形式のみ）

```
目次: https://www.city.ozu.ehime.jp/kaigiroku/pdf/1701_rinji_mokuji.pdf
会議録: https://www.city.ozu.ehime.jp/kaigiroku/pdf/1701_rinji_01_01.pdf
付録: https://www.city.ozu.ehime.jp/kaigiroku/pdf/1701_rinji_furoku.pdf
```

---

## HTML 構造

### 年度インデックスページ（`y{N}.html`）

- 文字コード: Shift-JIS
- 構造: `<TABLE>` ベースのレイアウト
- 各行に会議日、内容説明、目次リンク、会議録リンクが含まれる
- 会議種別は `◆第N回定例会(月)◆` / `◆第N回臨時会(月)◆` の見出しで区切られる
- コメントアウト（`<!-- -->`）で未公開の定例会が含まれることがある

**リンク抽出パターン（Cheerio）:**

```typescript
// 目次リンク
$('a[href*="mokuji"]').each((_, el) => {
  const href = $(el).attr('href'); // 例: "R08/202601rinji-mokuji.html"
});

// 会議録リンク
$('a').filter((_, el) => $(el).text().trim() === '会議録').each((_, el) => {
  const href = $(el).attr('href'); // 例: "R08/202601rinji-1.html"
});
```

### 目次ページ（`*-mokuji.html`）

- 文字コード: UTF-8
- シンプルな `<P>` タグと `<BR>` による構造
- 議事項目ごとに会議録本文ページへのアンカーリンクが付与される

```html
<A href="202601rinji-1.html#202601rinji-1-01">市長議会招集あいさつ</A>
```

- 付録ページへのリンクも末尾に含まれる

### 会議録本文ページ（`*-{N}.html`）

- 文字コード: UTF-8
- 構造: `<BODY>` 直下の `<P><FONT face="ＭＳ ゴシック">` タグ内にすべてのテキストが `<BR>` 区切りで入る
- ページネーションなし（1 会期複数日の場合は別ファイルに分割: `-1.html`, `-2.html`, ... ）

**発言者パターン:**

```
○新山勝久議長　ただいまから令和８年大洲市議会第１回臨時会を開会いたします。
○二宮隆久市長　議長
○18番梅木加津子議員　議案第１号に対する質疑を行います。
```

- `○{氏名}{役職}` の形式。役職が後置される（他自治体と異なる点）
- アンカー付き発言者行: `<A name="{ID}">○{氏名}{役職}</A>`
- 登壇表記: `〔18番　梅木加津子議員　登壇〕`

**ヘッダー情報:**

```
令和８年大洲市議会第１回臨時会会議録　第１号

令和８年１月13日（火曜日）
```

---

## スクレイピング戦略

### Step 1: 年度インデックスから会議録 URL リストを収集

`top.html` を取得し、年度リンク（`y05.html`〜`y26.html`）を列挙する。各年度インデックスを Shift-JIS でデコードし、会議録リンクを抽出する。

```typescript
// Shift-JIS デコード（Node.js）
const buffer = await fetch(url).then(r => r.arrayBuffer());
const text = new TextDecoder('shift_jis').decode(buffer);
```

### Step 2: 会議録本文 HTML を取得・パース

各会議録 HTML（UTF-8）を取得し、テキストを抽出する。

```typescript
// 発言者の抽出（正規表現案）
const speakerPattern = /^○(.+?)　/;
// 例: ○新山勝久議長 → speaker="新山勝久議長"
// 例: ○18番梅木加津子議員 → speaker="18番梅木加津子議員"

// 登壇の検出
const podiumPattern = /^〔(\d+番)?(.+?)議員\s*登壇〕/;

// ヘッダーから開催日の抽出
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;

// 会議名の抽出
const sessionPattern = /大洲市議会(.+?)会議録/;
```

### Step 3: 平成17〜18年の PDF 対応

`y05.html`・`y06.html` の PDF リンクは `pdf/` ディレクトリ配下にある。PDF スクレイピングが必要な場合は別途 PDF パーサーで対応する（優先度低）。

---

## データ収録範囲

| 年度 | 形式 | 備考 |
| --- | --- | --- |
| 令和8年（2026年）〜 | HTML（UTF-8） | 現在進行中 |
| 令和2年〜令和7年 | HTML（UTF-8） | `R0{N}/` ディレクトリ |
| 平成20年〜平成31年/令和元年 | HTML（UTF-8） | `H{NN}/` ディレクトリ |
| 平成19年 | HTML（Shift-JIS） | URL にスペースを含む古い形式 |
| 平成17〜18年 | PDF | `pdf/` ディレクトリ配下 |

---

## 注意事項

- **フレームセット**: ブラウザ直アクセスでは `index.html` がフレームを返す。スクレイピング時は `top.html` と各 `y{N}.html` を直接取得する
- **文字コード混在**: 年度インデックス（`y{N}.html`）は Shift-JIS、会議録本文は UTF-8 で異なるため、ファイルごとに文字コードを判定する必要がある
- **コメントアウト**: 年度インデックス HTML 内で未公開・未掲載の定例会が HTML コメントアウトで残っている。`<!-- -->` 内のリンクは取得不可
- **ページネーションなし**: 一覧は静的 HTML のため無限スクロールやページネーションはない
- **PDF は優先度低**: 平成17〜18年は PDF のみで、HTML テキスト取得不可
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **`top.html` から全年度リンクを収集**: 年度 URL（`y05.html`〜`yNN.html`）を動的に列挙し、将来の年度追加にも対応する
2. **年度インデックスを Shift-JIS でパース**: 各 `y{N}.html` は Shift-JIS エンコードのため `TextDecoder('shift_jis')` を使用する
3. **会議録本文は UTF-8 で取得**: 平成20年以降の会議録 HTML は UTF-8 のため通常の `fetch` で取得可能
4. **目次ページを活用**: `*-mokuji.html` には議事項目とアンカーリンクが整理されているため、発言の構造把握に有用
5. **差分更新**: 年度インデックスの HTML は更新頻度が低く、会議録 HTML は一度公開されると変更されない。新しい会議のみを差分取得することで効率化できる
