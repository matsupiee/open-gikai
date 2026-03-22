# 栗山町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kuriyama.hokkaido.jp/site/gikai/7389.html
- 分類: 年度別・会期別にHTML/PDF形式で公開（独自CMS、既存アダプターでは対応不可）
- 文字コード: Shift_JIS（HTML会議録）、UTF-8（一覧ページ）
- 特記: フレームセット構成のHTMLと添付PDFの2形式が混在

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（本会議） | `https://www.town.kuriyama.hokkaido.jp/site/gikai/7389.html` |
| HTML会議録（フレームセット） | `/gikai/minutes/kaigiroku/{era}/{prefix}{YYMM}t.html`（定例会） |
| HTML会議録（フレームセット） | `/gikai/minutes/kaigiroku/{era}/{prefix}{YYMM}r.html`（臨時会） |
| 目次フレーム | `/gikai/minutes/kaigiroku/{era}/{prefix}{YYMM}t-index.html` |
| タイトルフレーム | `/gikai/minutes/kaigiroku/{era}/{prefix}{YYMM}t-title.html` |
| 本文フレーム（日ごと） | `/gikai/minutes/kaigiroku/{era}/{prefix}{YYMM}t01.html`、`...t02.html` 等 |
| PDF会議録（臨時会中心） | `/uploaded/attachment/{ID}.pdf` |

### era / prefix の命名規則

| 年代 | era | prefix 例 |
| --- | --- | --- |
| 平成24年〜平成30年 | `h24`〜`h30` | `h24`, `h25`, ..., `h30` |
| 平成31年・令和元年 | `h31` | `h31`, `r01` |
| 令和2年〜 | `r2`〜`r7` | `r02`, `r03`, ..., `r07` |

### フレームセットの構造（近年: 令和3年定例会以降）

```
{prefix}{YYMM}t.html        ← フレームセット親（rows=130,*, cols=300,*）
├── {prefix}{YYMM}t-title.html  ← 上部タイトルバー
├── {prefix}{YYMM}t-index.html  ← 左カラム目次（日ごとのリンク一覧）
└── {prefix}{YYMM}t01.html      ← メインコンテンツ（第1日目）
    {prefix}{YYMM}t02.html      ← メインコンテンツ（第2日目）
    ...
```

### フレームセットの構造（旧形式: 平成24年〜令和3年前半）

```
{prefix}-n.html              ← フレームセット親
├── {prefix}-t.html          ← タイトルフレーム
├── {prefix}-l.html          ← 左カラム目次
└── {prefix}.html            ← メインコンテンツ
```

旧形式では1会期=1HTMLファイルにまとまっている場合がある。

---

## 公開形式の分類

### HTML形式（定例会議が中心）

- 6月、9月、12月、3月の定例会議はHTML形式で公開
- フレームセット構成（Shift_JIS）
- 本文は `<pre>` タグまたは `<table>` タグ内に格納

### PDF形式（臨時会議が中心）

- 5月、7月、8月、10月、11月、1月、2月等の臨時会議はPDF形式で公開
- `/uploaded/attachment/{ID}.pdf` 形式のURL
- PDFのIDは連番だが予測不可能（一覧ページからリンクを取得する必要あり）

---

## スクレイピング戦略

### Step 1: 一覧ページからリンクの収集

一覧ページ `https://www.town.kuriyama.hokkaido.jp/site/gikai/7389.html`（UTF-8）をパースし、全会議録へのリンクを収集する。

**収集方法:**

1. 一覧ページのHTMLを取得（UTF-8）
2. `<div id="main_body">` 内の `<h3>` で年度を識別
3. 各 `<ul>` 内の `<a>` タグから `href` を抽出
4. リンク先URLでHTML形式（`/gikai/minutes/`）とPDF形式（`/uploaded/attachment/`）を分類
5. リンクテキストから会期名（例: "6月定例会議"、"5月臨時会議"）を取得

**抽出データ:**

```typescript
type MinutesLink = {
  year: string;       // "令和7年" 等
  sessionName: string; // "6月定例会議" 等
  url: string;        // 絶対URL
  format: "html" | "pdf";
};
```

### Step 2: HTML会議録の取得

フレームセット親HTMLからフレーム内のURLを解決し、本文フレームを直接取得する。

1. フレームセット親HTMLを取得（Shift_JIS）
2. `<frame>` タグの `src` 属性からインデックスフレームURLと本文フレームURLを抽出
3. インデックスフレーム（`*-index.html` または `*-l.html`）から全本文ページのリンクを収集
4. 各本文ページ（`*01.html`, `*02.html`, ...）を個別に取得

**注意:**
- フレームセット親はブラウザ用であり、直接パースしても本文は含まれない
- 必ずフレーム内の個別HTMLを取得すること

### Step 3: 会議録のパース

#### 近年形式（令和3年定例会以降）

本文は `<pre>` タグ（メタ情報部分）と `<br>` タグ区切り（発言部分）で構成。

**発言者パターン:**

```
〇<b>議長（鵜川和彦君）</b>　発言内容...
◎<b>開議の宣告</b>
```

- `〇` + `<b>役職（氏名君）</b>` で発言者を識別
- `◎` + `<b>議題名</b>` で議事進行の区切りを識別
- 登壇表記は確認されず（近年形式では省略されている可能性）

**メタ情報:**

```
令和７年栗山町議会定例会１２月定例会議会議録（第１日目）
令和７年１２月９日　午前　９時３０分開議
```

- `<pre>` タグ内の冒頭行から会議名・開催日を抽出
- アンカー `<a name="0001">` 〜 `<a name="0005">` で出席議員・説明員・付議事件を区分

#### 旧形式（平成24年〜令和3年前半）

本文は `<table class="type0">` 内に構造化されて格納。

**発言者パターン:**

```html
<td class="speakerchairperson">○<span class="chairperson">議長（鵜川和彦君）</span></td>
<td class="speakermayor">◎<span class="mayor">町長（椿原紀昭君）</span></td>
```

- CSSクラスで発言者の種別を識別可能: `chairperson`（議長）, `mayor`（町長/副町長）, `officer`（職員）
- `<span class="situation">〔町長　椿原紀昭君登壇〕</span>` で登壇を検出
- `<span class="subject">` で議題名を識別
- アンカー `<a id="Sid-{番号}">` で発言者、`<a id="Pid-{番号}">` で段落を識別

#### パース用正規表現（案）

```typescript
// 近年形式: 発言者の抽出
const speakerPatternNew = /^[〇○]<b>(.+?)（(.+?)）<\/b>/;
// 例: 〇<b>議長（鵜川和彦君）</b> → role="議長", name="鵜川和彦君"

// 近年形式: 議事進行の区切り
const agendaPatternNew = /^◎<b>(.+?)<\/b>/;
// 例: ◎<b>開議の宣告</b> → agenda="開議の宣告"

// 旧形式: 発言者の抽出（HTMLタグ内）
const speakerPatternOld = /[〇○◎].*?<span class="(?:chairperson|mayor|officer|member)">(.+?)（(.+?)）<\/span>/;

// 開催日の抽出
const datePattern = /(?:令和|平成)[０-９\d]+年[０-９\d]+月[０-９\d]+日/;

// 開議時刻の抽出
const timePattern = /(?:午前|午後)\s*[０-９\d]+時[０-９\d]+分(?:開議|開会)/;
```

### Step 4: PDF会議録の取得

1. Step 1 で収集したPDFリンクをダウンロード
2. PDFからテキストを抽出（pdf-parse等を使用）
3. テキストの構造は HTML版と同様の書式が想定される

---

## 注意事項

- 文字コードが混在: 一覧ページはUTF-8、会議録HTMLはShift_JIS。取得時にエンコーディングを適切に処理すること
- フレームセット構成のため、一般的なHTMLパーサーではフレーム内コンテンツを取得できない。フレーム内URLを解決して個別に取得する必要がある
- 全角数字が多用されている（議員番号、日付、時刻等）。数値比較時は半角変換が必要
- 氏名の文字間にスペースが挿入されている（例: "齊　藤　義　崇"）。正規化処理が必要
- 近年形式と旧形式でHTML構造が異なる。パーサーは両方に対応する必要がある
- 臨時会議はPDF形式のみの場合が多く、HTML版が存在しない
- ページネーションは存在しない（一覧ページに全年度のリンクが1ページに表示される）
- 平成24年〜令和7年の範囲で約100件の会議録が存在（HTML + PDF合算）

---

## 推奨アプローチ

1. **一覧ページから全量リスト作成**: 一覧ページ1ページに全リンクが集約されているため、まずここから全会議録URLのリストを作成
2. **HTML/PDF の分岐処理**: リンク先URLパターンで形式を判定し、それぞれ専用のパーサーで処理
3. **フレーム解決を自動化**: フレームセット親HTMLから `<frame src="...">` を解析し、本文フレームURLを自動解決
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2秒）を設ける
5. **差分更新**: 一覧ページの `更新日` 表示（例: "2026年2月3日更新"）を監視し、変更があった場合のみ再取得する
