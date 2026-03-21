# 山梨県南部町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.nanbu.yamanashi.jp/kakuka/gikai/kaigiroku.html
- 分類: 町公式サイトによる PDF 直接公開（検索可能なデータベースなし）
- 文字コード: UTF-8
- 特記: 同名の鳥取県南部町（`nanbu.md`）と区別するため `nanbu-yamanashi.md` とする

---

## URL 構造

| ページ | URL |
| --- | --- |
| 会議録一覧ページ | `https://www.town.nanbu.yamanashi.jp/kakuka/gikai/kaigiroku.html` |
| PDF ファイル | `https://www.town.nanbu.yamanashi.jp/kakuka/gikai/files/{ファイル名}.pdf` |

ページネーションなし。1 ページに全年度分の PDF リンクが掲載される。

---

## 掲載形式

- 会議録は PDF 形式のみで提供される
- 一覧ページに年度ごとのテーブル（定例会列・臨時会列）が並んでおり、各セルに PDF へのリンクが記載される
- 年度は新しい順（上から令和 8 年→平成 24 年）に並んでいる
- 最古の記録: 平成 24 年（2012 年）

---

## 会議の種別

| 種別 | 備考 |
| --- | --- |
| 定例会 | 年 4 回（3 月・6 月・9 月・12 月）が基本 |
| 臨時会 | 年度によって 1〜4 回程度 |

---

## PDF ファイル名のパターン

ファイル名は年度・時期によって命名規則が異なる。統一された規則はなく、手動で付与されている。

### 新しい年度（令和 4 年以降）

| 種別 | パターン例 |
| --- | --- |
| 定例会 | `Gikai-TeireiRec{YYYYMM}re.pdf`、`Gikai-TeireiRec{YYYYMM}.pdf` |
| 臨時会 | `Gikai-RinjiRec{YYYYMM}.pdf`、`Gikai-RinjiRec{YYYYMM}re.pdf` |

例:
- `Gikai-TeireiRec202512re.pdf`（令和 7 年第 4 回定例会・12 月）
- `Gikai-RinjiRec202507.pdf`（令和 7 年第 3 回臨時会・7 月）
- `Gikai-TeireiRec202403..pdf`（ファイル名にドット 2 つのタイポが存在する）

### 古い年度（平成 29 年〜令和 3 年頃）

| 種別 | パターン例 |
| --- | --- |
| 定例会 | `{YYYYMM}teireikai.pdf`、`{YYYYMM}-teireikai.pdf` |
| 臨時会 | `{YYMMDD}-rinzikai.pdf`（和暦 2 桁 + 月日）、`{YYYYMMDD}-rinzikai.pdf` |

例:
- `201703teireikai.pdf`（平成 29 年第 1 回定例会・3 月）
- `290522-rinzikai.pdf`（平成 29 年第 1 回臨時会・5 月 22 日）
- `300723-rinzikai.pdf`（平成 30 年第 2 回臨時会・7 月 23 日）

### 古い年度（平成 24〜28 年）

| 種別 | パターン例 |
| --- | --- |
| 定例会 | `{YYYYMM}-teireikai.pdf` |
| 臨時会 | `{YYYYMMDD}-rinzikai.pdf`、`{YYYYMM}-rinzikai.pdf` |

例:
- `201203-teireikai.pdf`（平成 24 年第 1 回定例会・3 月）
- `20120207-rinzikai.pdf`（平成 24 年第 1 回臨時会・2 月 7 日）
- `2012.11.09-rinzikai.pdf`（ドット区切りのファイル名も存在する）

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

一覧ページ（`kaigiroku.html`）を取得し、`files/` 以下への PDF リンクを Cheerio 等で抽出する。

```typescript
// PDF リンクの抽出（例）
const links = $('a[href*="files/"][href$=".pdf"]');
links.each((_, el) => {
  const href = $(el).attr('href');      // 例: "files/Gikai-TeireiRec202512re.pdf"
  const label = $(el).text().trim();    // 例: "第４回定例会(12月）"
  // ... 年度見出し（h2）と対応付けて年度情報を取得する
});
```

- ページネーションなし → 1 リクエストで全 PDF リンクを取得できる
- 各 PDF リンクは年度を示す `<h2>` 要素（例: `令和７年(2025年)`）の直下テーブルに属するため、DOM 構造をたどって年度情報を付与する

### Step 2: PDF のダウンロードとテキスト抽出

ベース URL + `kakuka/gikai/` + href でフルパスを組み立てる。

```
https://www.town.nanbu.yamanashi.jp/kakuka/gikai/files/Gikai-TeireiRec202512re.pdf
```

- PDF からのテキスト抽出には `pdf-parse` 等を使用する
- 会議録は複数ページにまたがる場合があるため、全ページのテキストを連結して処理する

### Step 3: メタ情報の抽出

PDF のテキストから以下を抽出する:

- **開催年度**: 一覧ページの `<h2>` 要素の年度情報（例: `令和７年(2025年)`）
- **会議種別**: リンクテキスト（例: `第４回定例会(12月）`、`第１回臨時会(4月)`）
- **開催日・会議録タイトル**: PDF 本文冒頭から抽出（`令和○年○月○日` 形式）

---

## 注意事項

- **ファイル名の非統一**: 年度によってファイル名の命名規則が異なるため、URL を直接推測することはできない。必ず一覧ページをクロールして href を取得すること
- **タイポの存在**: `Gikai-TeireiRec202403..pdf`（ドット 2 つ）のようなタイポが存在するため、href をそのまま使用する
- **searchable なデータベースなし**: 全文検索や発言者検索の機能はなく、PDF のみで提供されている
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
- **令和 8 年（2026 年）**: 現時点では未掲載（テーブルは存在するが PDF リンクなし）

---

## 推奨アプローチ

1. **一覧ページを単一リクエストで取得**: ページネーションがないため、1 回のリクエストで全 PDF リンクを収集できる
2. **DOM 構造で年度を特定**: `<h2>` → `<table>` の順でたどり、各 PDF リンクに年度を付与する
3. **PDF 本文からメタ情報を補完**: 会議名・開催日は PDF テキストから正規表現で抽出する
4. **差分更新**: 一覧ページの href リストと取得済みリストを比較し、未取得の PDF のみをダウンロードする
