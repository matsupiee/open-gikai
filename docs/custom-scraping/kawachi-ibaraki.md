# 河内町（茨城）議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.ibaraki-kawachi.lg.jp/page/dir000122.html
- 分類: 公式ウェブサイト上での年度別 PDF 公開（統一的な検索システムなし）
- 文字コード: UTF-8
- CMS: 公開型ウェブサイト管理システム（page、dir ベースの URL 体系）
- 特記:
  - 独立した会議録検索システムは存在しない
  - 年度ごとに専用ページが用意されており、各ページに「初日」「最終日」等の PDF リンクが列挙される形式
  - 本会議（定例会・臨時会）のみが掲載されており、委員会等は掲載なし
  - 平成24年〜令和7年分が公開されている

---

## URL 構造

### インデックスページ

会議録の年度別ページへのリンク一覧が掲載されている:

| ページ | URL |
| --- | --- |
| 会議録（年度一覧） | `https://www.town.ibaraki-kawachi.lg.jp/page/dir000122.html` |

### 年度別ページ

各年度ごとに専用ページが用意されており、その年度に開催された会議と PDF リンクが列挙されている:

| 年度 | URL | ページID |
| --- | --- | --- |
| 令和7年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page002683.html` | page002683.html |
| 令和6年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page002269.html` | page002269.html |
| 令和5年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page001933.html` | page001933.html |
| 令和4年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page001684.html` | page001684.html |
| 令和3年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page001399.html` | page001399.html |
| 令和2年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page001149.html` | page001149.html |
| 令和元年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000894.html` | page000894.html |
| 平成30年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000763.html` | page000763.html |
| 平成29年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000568.html` | page000568.html |
| 平成28年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000224.html` | page000224.html |
| 平成27年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000229.html` | page000229.html |
| 平成26年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000234.html` | page000234.html |
| 平成25年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000240.html` | page000240.html |
| 平成24年 | `https://www.town.ibaraki-kawachi.lg.jp/page/page000244.html` | page000244.html |

### PDF ファイル格納場所

全 PDF はサイト内のドキュメントディレクトリに格納されている:

```
https://www.town.ibaraki-kawachi.lg.jp/data/doc/[タイムスタンプ]_doc_11_0.pdf
```

---

## 会議の種別

本会議のみが掲載されている。

### 開催パターン

年間を通じて以下の会議が開催される:

| 時期 | 種別 | 回数 | 備考 |
| --- | --- | --- | --- |
| 3月 | 定例会 | 第1回 | 初日・最終日の2ファイル |
| 5月 | 臨時会 | 第2回 | 1ファイル（臨時会） |
| 6月 | 定例会 | 第2回 | 初日・最終日の2ファイル |
| 9月 | 定例会 | 第3回 | 初日・最終日の2ファイル |
| 11月 | 臨時会 | 第3回 | 1ファイル（臨時会） |
| 12月 | 定例会 | 第4回 | 初日・最終日の2ファイル |

---

## HTML 構造

### 年度別ページの構造

```html
<h1 id="pageTitle">令和6年</h1>
<div id="contents">
  <h3>第4回（12月）定例会</h3>
  <table>
    <tbody>
      <tr>
        <th>形式</th>
        <th>会議録ファイル名</th>
        <th>形式</th>
        <th>会議録ファイル名</th>
      </tr>
      <tr>
        <td><img ... /></td>
        <td>
          初日
          <a href="https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565205_doc_11_0.pdf">
            初日
          </a>
          （PDF形式／390KB）
        </td>
        <td><img ... /></td>
        <td>
          <a href="https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565241_doc_11_0.pdf">
            最終日
          </a>
          （PDF形式／635KB）
        </td>
      </tr>
    </tbody>
  </table>

  <h3>第3回（11月）臨時会</h3>
  <table>
    <tbody>
      <tr>
        <th>形式</th>
        <th colspan="3">会議録ファイル名</th>
      </tr>
      <tr>
        <td><img ... /></td>
        <td colspan="3">
          <a href="https://www.town.ibaraki-kawachi.lg.jp/data/doc/1738565105_doc_11_0.pdf">
            初日
          </a>
          （PDF形式／245KB）
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## PDF ファイルの構造

### メタ情報

各 PDF の冒頭には以下のメタ情報が記載されている:

```
令和６年第４回
河内町議会定例会会議録

令和６年１２月５日

１．出席議員
第１号
午前１０時１０分開会
```

- 開催年月日: `令和X年X月X日` 形式
- 会議種別: `定例会` または `臨時会`
- 回数: `第X回`

### 発言の構造

発言者は以下のパターンで記載される:

```
１番 山本 豊 君
２番 髙橋 利彰 君
...
（出席議員一覧）

議長（役職） 名前
副議長（役職） 名前
```

- 議員は番号 + 氏名で識別される
- 議長・副議長など役職が記載される
- 発言内容は発言者の次行以降に続く

---

## スクレイピング戦略

検索システムが存在しないため、インデックスページから年度ページへのリンクを収集し、各年度ページから PDF リンクを抽出する。

### Step 1: 年度ページへのリンク収集

インデックスページ（`dir000122.html`）から全年度ページへのリンクを抽出する。

```
GET https://www.town.ibaraki-kawachi.lg.jp/page/dir000122.html
```

- `<div id="dir">` 内の年度名（令和7年〜平成24年）と対応する `<a>` タグの `href` 属性を抽出
- 相対パス（例: `page002683.html`）を絶対 URL に変換

**抽出パターン例:**

```typescript
// 年度ブロックの抽出
const yearBlocks = $('div.dirIndex');
yearBlocks.each((i, el) => {
  const yearText = $(el).find('h3').text(); // "令和7年" など
  const link = $(el).find('a').attr('href');
  // 例: { year: "令和7年", url: "https://www.town.ibaraki-kawachi.lg.jp/page/page002683.html" }
});
```

### Step 2: 年度ページから会議録リンクを収集

各年度ページから会議タイプと PDF リンクを抽出する。

```
GET https://www.town.ibaraki-kawachi.lg.jp/page/page002683.html
```

- `<h3>` で会議タイプ（例: `第4回（12月）定例会`）を抽出
- 続く `<table>` 内の `<a>` タグから PDF リンクを抽出
- 各リンク前後のテキストから「初日」「最終日」といったラベルを抽出

**HTML パターン:**

- 定例会: `<tr>` 内に2つの `<a>` （初日・最終日）
- 臨時会: `<tr>` 内に1つの `<a>` （初日）

**抽出パターン例:**

```typescript
// 会議ブロックの抽出
const sessions = $('#contents').children('h3');
sessions.each((i, el) => {
  const sessionName = $(el).text(); // "第4回（12月）定例会" など
  const table = $(el).next('table');

  // PDF リンクを抽出
  const links = [];
  table.find('a').each((j, link) => {
    const href = $(link).attr('href');
    const label = $(link).text(); // "初日" or "最終日"
    links.push({ label, url: href });
  });

  // 例: { session: "第4回（12月）定例会", links: [{ label: "初日", url: "..." }, ...] }
});
```

### Step 3: PDF のダウンロードとテキスト抽出

収集した PDF URL から PDF をダウンロードし、テキストを抽出する。

- 1つの PDF ファイルに1回の会議録が収録されている（初日と最終日は別ファイル）
- PDF は標準テキスト形式であり、スキャン画像ではない

---

## 注意事項

- **差分更新**: インデックスページは会議録が追加されるたびに更新される。新しい会議録の追加を検知するには、インデックスページの年度リンク一覧と各年度ページを前回取得時と比較する。
- **ファイル名の規則性**: PDF ファイル名はタイムスタンプベースであり、年号や回数の情報は含まれない。メタ情報は必ず HTML の見出しと表から抽出すること。
- **ページネーションなし**: 各年度ページは1ページ完結であり、ページネーション機能はない。
- **PDF のみ**: テキスト形式での提供はなく、全データが PDF 形式。
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。
- **初日と最終日の分離**: 定例会では「初日」と「最終日」が別ファイルで提供される。全会議内容を取得するには両ファイルの併合が必要。

---

## 推奨アプローチ

1. **インデックスページから年度リストを取得**: `dir000122.html` から全年度ページへのリンクを一度取得
2. **各年度ページをクロール**: 保持した年度 URL リストを順に取得し、会議リストと PDF リンクを抽出
3. **PDF メタ情報の抽出**: 各 PDF をダウンロード後、冒頭の年号・開催日・会議種別情報を抽出
4. **差分更新**: インデックスページと各年度ページを定期的に再取得し、新規追加分のみをダウンロード
5. **レート制限**: 自治体サイトの負荷を考慮し、リクエスト間に1〜2秒の待機を設ける
