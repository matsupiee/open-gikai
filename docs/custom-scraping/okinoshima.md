# 隠岐の島町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.okinoshima.shimane.jp/
- 分類: 町公式サイトで PDF を直接公開（外部の専用検索システムは使用していない）
- 文字コード: UTF-8
- 特記: SMART CMS を使用。会議録は単一ページ（ページ ID: 4407）に全年度分の PDF リンクがまとめて掲載されている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.town.okinoshima.shimane.jp/chosei/gikai/index.html` |
| 本会議・委員会 | `https://www.town.okinoshima.shimane.jp/chosei/gikai/honkaigi_iinkai/index.html` |
| 会議録一覧（単一ページ） | `https://www.town.okinoshima.shimane.jp/chosei/gikai/honkaigi_iinkai/honnkaigi_gijiroku/4407.html` |
| PDF ダウンロード | `https://www.town.okinoshima.shimane.jp/material/files/group/3/{ファイル名}.pdf` |

---

## ページ構造

### 会議録一覧ページ（4407.html）

全年度・全会議の PDF リンクが 1 ページにまとめて掲載されている。年度・会議ごとに `<h2>` 見出しで区切られている。

```html
<h2>令和7年第3回(8月7日)臨時会会議録</h2>
<a href="//www.town.okinoshima.shimane.jp/material/files/group/3/0703rinnjikai.pdf">
  令和7年第3回臨時会 (PDFファイル: 189.4KB)
</a>

<h2>令和7年第2回(6月)定例会会議録</h2>
<a href="//www.town.okinoshima.shimane.jp/material/files/group/3/syoniti00702.pdf">
  第1日(初日) (PDFファイル: XXX.XKB)
</a>
<a href="//www.town.okinoshima.shimane.jp/material/files/group/3/ippann0702.pdf">
  第5日(一般質問) (PDFファイル: XXX.XKB)
</a>
<!-- ... -->
```

- ページネーションなし（全件が 1 ページに掲載）
- PDF リンクの `href` はプロトコル相対 URL（`//www.town.okinoshima.shimane.jp/...`）

---

## 掲載年度範囲

平成21年（2009年）第2回定例会 〜 令和7年（2025年）第3回臨時会

約16年分の会議録が掲載されている。

---

## 会議種別

定例会と臨時会が掲載されている。本会議のみで、委員会の会議録は掲載されていない。

| 種別 | 備考 |
| --- | --- |
| 定例会 | 年4回が標準（第1回: 3月、第2回: 6月、第3回: 9月、第4回: 12月） |
| 臨時会 | 年によって回数が異なる |

### 定例会の日別区分

1 回の定例会が複数の PDF に分割されている場合がある。

| 区分 | ファイル名パターン | 備考 |
| --- | --- | --- |
| 初日 | `syoniti{YYNN}.pdf` | 開会・議案上程等 |
| 一般質問 | `ippann{YYNN}.pdf` | 一般質問の日 |
| 総括質疑 | `shitugi{YYNN}.pdf` | 総括質疑の日 |
| 最終日 | `saisyuubi{YYNN}.pdf` | 採決・閉会等 |
| 臨時会 | `{YYNN}rinnjikai.pdf` | 臨時会（1ファイル） |

※ `{YYNN}` は年号下2桁 + 回次2桁（例: `0702` = 令和7年第2回）

---

## PDF ファイル名の命名規則

ファイル名の形式は年代によって異なる。

| 期間 | 形式 | 例 |
| --- | --- | --- |
| 近年（令和〜） | `{区分}{YYNN}.pdf` | `syoniti0702.pdf`, `ippann0604.pdf` |
| 中間期 | `kaigiroku{YYYYMMDD}.pdf` | `kaigiroku20151203.pdf` |
| 古い時期（平成21年頃） | ハッシュ値形式 | `43530291.pdf`, `782e4e231f74d7009f...pdf` |

- ファイル名の形式が統一されていないため、**HTML のリンクテキストからメタ情報を取得する**
- PDF ベース URL: `https://www.town.okinoshima.shimane.jp/material/files/group/3/`

---

## PDF の内容構造

### メタ情報（冒頭部分）

PDF の冒頭に以下の情報が記載されている。

```
令和７年第２回隠岐の島町議会定例会会議録

開　会（開議）　令和7年6月23日（月）9時30分　宣告

会議録署名議員の追加氏名　5番　山田　浩太　議員
```

- 会議名: `{年号}年第{N}回隠岐の島町議会{定例会|臨時会}会議録`
- 開催日時: `{年号}年{M}月{D}日（{曜日}）{時}時{分}分　宣告`

### 出席情報

```
１．出席議員
 1番　松山　　貢　7番　齋藤　則子　12番　前田　芳樹
 ...

１．欠席議員　　3番　西村　万里子

１．地方自治法第121条の規定により出席した者の職氏名
 町　　　長　池田　高世偉
 副　町　長　大庭　孝久
 ...
```

### 発言の構造

発言者パターン:

```
○議長（ 安 部 大 助 ）
○2番（ 村 上 　 一 ）
○町長（ 池 田 高世偉 ）
```

- `○` で始まり、役職 or 番号 + 括弧内に氏名（全角スペースで字間が空く場合あり）
- 日程見出し: **太字**で `日　程　第　１．{議題}` の形式
- 発言内容は発言者行の後に続くテキスト

### パース用正規表現（案）

```typescript
// 発言者の抽出（全角スペースを含む氏名に対応）
const speakerPattern = /^○(.+?)（\s*(.+?)\s*）/;
// 例: ○2番（ 村 上 　 一 ） → role="2番", name="村 上 　 一"
// ※ 氏名の全角スペースは後処理で除去する

// 開催日の抽出
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;

// 会議名の抽出
const sessionPattern = /(?:令和|平成)\d+年第(\d+)回隠岐の島町議会(定例会|臨時会)/;
```

---

## スクレイピング戦略

### Step 1: 会議録一覧ページから PDF URL を収集

会議録一覧ページ（`4407.html`）を 1 回取得するだけで、全年度・全会議の PDF リンクを収集できる。

```typescript
// PDF リンクの抽出例
const pdfLinks = $('a[href$=".pdf"]')
  .map((_, el) => ({
    url: new URL($(el).attr('href')!, 'https://www.town.okinoshima.shimane.jp').toString(),
    label: $(el).text().trim(),
  }))
  .toArray();
```

### Step 2: h2 見出しから会議メタ情報を抽出

各 PDF リンクの直前の `<h2>` 見出しから、年度・回次・種別を抽出する。

```typescript
// h2 見出しから会議情報を抽出
const headingPattern = /(?:令和|平成)(\d+)年第(\d+)回.*?(定例会|臨時会)/;
// 例: "令和7年第2回(6月)定例会会議録" → era_year=7, count=2, type="定例会"
```

### Step 3: 各 PDF を取得・テキスト抽出

PDF ファイルをダウンロードし、テキスト抽出ツール（pdf-parse 等）でテキスト化する。

- PDF は 60〜70 ページ程度のものがある（一般質問の回など）
- フォントが埋め込まれているため、テキスト抽出は可能と推測される

### Step 4: テキストから発言を分割

抽出したテキストから `○` で始まる発言者行を検出し、発言単位に分割する。

```typescript
// テキストを行単位に分割し、発言者行で区切る
const lines = text.split('\n');
const speeches: { role: string; name: string; content: string }[] = [];
let current: { role: string; name: string; content: string } | null = null;

for (const line of lines) {
  const match = line.match(/^○(.+?)（\s*(.+?)\s*）/);
  if (match) {
    if (current) speeches.push(current);
    current = {
      role: match[1]!.trim(),
      name: match[2]!.replace(/\s+/g, ''),  // 全角スペースを除去
      content: line.replace(/^○.+?）/, '').trim(),
    };
  } else if (current) {
    current.content += '\n' + line;
  }
}
if (current) speeches.push(current);
```

---

## 注意事項

- **単一ページ構成**: 全年度の PDF リンクが 1 ページに集約されているため、ページ遷移は不要
- **プロトコル相対 URL**: PDF リンクの `href` が `//www.town.okinoshima.shimane.jp/...` 形式のため、`https:` を補完する必要がある
- **ファイル名の不統一**: 年代によりファイル名の形式が異なるため、ファイル名からのメタ情報抽出は困難。`<h2>` 見出しやリンクテキストからメタ情報を取得する
- **氏名の全角スペース**: PDF 内の発言者名に全角スペースが挿入されている場合がある（例: `村 上 　 一`）。後処理でスペースを除去する
- **レート制限**: PDF ダウンロード時に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **1 ページで全量収集**: 会議録一覧ページ（`4407.html`）を 1 回取得するだけで全 PDF URL を収集可能
2. **h2 見出しでグルーピング**: `<h2>` 要素をパースして会議ごとに PDF をグルーピングする
3. **PDF テキスト抽出**: pdf-parse 等でテキスト化し、`○` パターンで発言を分割する
4. **差分更新**: 取得済み PDF URL のリストと比較し、新規 URL のみダウンロードする
5. **レート制限**: PDF ダウンロード時に各リクエスト間に 1〜2 秒の待機を設ける
