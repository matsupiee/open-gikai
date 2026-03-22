# 沼田町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.numata.hokkaido.jp/section/gikai/index.html
- 分類: 自治体公式サイトに PDF ファイルを直接掲載（会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 年度別の一覧ページから各会議録 PDF へリンクする構成

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.town.numata.hokkaido.jp/section/gikai/index.html` |
| 年度別会議録一覧 | `https://www.town.numata.hokkaido.jp/section/gikai/{ページID}.html` |
| 会議録 PDF | `https://www.town.numata.hokkaido.jp/section/gikai/{ページID}-att/{ファイルID}.pdf` |

---

## 年度別一覧ページ

議会トップページに平成8年〜令和7年までの年度別リンクが掲載されている。

| 年度 | ページパス |
| --- | --- |
| 令和7年 | `/section/gikai/h0opp2000000rbtu.html` |
| 令和6年 | `/section/gikai/h0opp2000000mzi1.html` |
| 令和5年 | `/section/gikai/h0opp2000000k42n.html` |
| 令和4年 | `/section/gikai/h0opp2000000k2l1.html` |
| 令和3年 | `/section/gikai/h0opp2000000k158.html` |
| 令和2年 | `/section/gikai/h0opp2000000jzv9.html` |
| 令和元年 | `/section/gikai/h0opp2000000jyik.html` |
| 平成30年 | `/section/gikai/h0opp2000000jx5r.html` |
| 平成29年 | `/section/gikai/h0opp2000000jvvc.html` |
| 平成28年 | `/section/gikai/h0opp2000000juhu.html` |
| 平成27年 | `/section/gikai/h0opp2000000jt80.html` |
| 平成26年 | `/section/gikai/h0opp2000000jrwe.html` |
| 平成25年 | `/section/gikai/h0opp2000000jqkt.html` |
| 平成24年 | `/section/gikai/h0opp2000000jp9m.html` |
| 平成23年 | `/section/gikai/h0opp2000000jnnw.html` |
| 平成22年 | `/section/gikai/h0opp2000000qful.html` |
| 平成21年 | `/section/gikai/h0opp2000000qgba.html` |
| 平成20年 | `/section/gikai/h0opp2000000qgoa.html` |
| 平成19年 | `/section/gikai/h0opp2000000qh0a.html` |
| 平成18年 | `/section/gikai/h0opp2000000qhst.html` |
| 平成17年 | `/section/gikai/h0opp2000000qi6c.html` |
| 平成16年 | `/section/gikai/h0opp2000000qiix.html` |
| 平成15年 | `/section/gikai/h0opp2000000qiuf.html` |
| 平成14年 | `/section/gikai/h0opp2000000qqow.html` |
| 平成13年 | `/section/gikai/h0opp2000000qr4w.html` |
| 平成11年 | `/section/gikai/h0opp2000000qrkn.html` |
| 平成10年 | `/section/gikai/h0opp2000000qs0f.html` |
| 平成9年 | `/section/gikai/h0opp2000000qsct.html` |
| 平成8年 | `/section/gikai/h0opp2000000qson.html` |

※ 平成12年の一覧ページは確認できない。

---

## ページ構造

### 議会トップページ

- 年度別の会議録一覧ページへのリンクがリスト形式で掲載
- 「議会構成」「一般質問要旨」「議会開催状況」「傍聴案内」「議決結果」等のリンクも同ページに存在

### 年度別会議録一覧ページ

- `<h4>` タグで「定例会」「臨時会」を区分
- `<h5>` タグで「第1回定例会」「第2回定例会」等の回次を区分
- `<ul>` リスト内に各日程の PDF リンクを掲載
- 各リンクのテキスト形式: `第N回（M日目）（令和X年Y月Z日） (PDF xxxKB)`
- PDF アイコン画像 (`/WSR/icon_pdf.gif`) が各リンクに付与

### PDF の URL パターン

```
https://www.town.numata.hokkaido.jp/section/gikai/{ページID}-att/{ファイルID}.pdf
```

- `{ページID}`: 年度別一覧ページの ID（例: `h0opp2000000rbtu`）
- `{ファイルID}`: 各 PDF 固有の ID（例: `h0opp2000000rbzi`）
- ページ ID と PDF ファイル ID に規則性はなく、連番ではない

---

## 会議の種類

年度により異なるが、一般的に以下の構成:

- **定例会**: 年4回（第1回〜第4回）。複数日にわたる場合は日ごとに PDF が分かれる
- **臨時会**: 年数回（回数は年度により変動）

---

## スクレイピング戦略

### Step 1: 年度別一覧ページの URL 収集

議会トップページ `index.html` から年度別一覧ページへのリンクを収集する。

- `/section/gikai/` 配下のリンクのうち、会議録一覧ページへのリンクを抽出
- 上記の年度別一覧表のとおり、ページ ID は不規則なため、トップページからのリンク抽出が必須

### Step 2: PDF リンクの収集

各年度別一覧ページから PDF リンクとメタ情報を抽出する。

**収集方法:**

1. 各年度ページの HTML を取得
2. `<h4>` から会議種別（定例会/臨時会）を判定
3. `<h5>` から回次を判定
4. `<ul>` 内の `<a>` タグから PDF の URL を抽出
5. リンクテキストから開催日・日次情報を抽出

**抽出用正規表現（案）:**

```typescript
// リンクテキストから情報を抽出
// 例: "第1回（1日目）（令和7年3月6日）"
// 例: "第2回（令和6年6月18日）"
const linkPattern = /第(\d+)回(?:（(\d+)日目）)?（((?:令和|平成)\d+年\d+月\d+日)）/;

// PDF リンクの抽出
const pdfLinkPattern = /href="([^"]+\.pdf)"/g;
```

### Step 3: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）を使用してテキストを抽出
- 会議録は一般的な議事録形式（発言者名 + 発言内容）で記載されていると想定

---

## 注意事項

- 会議録検索システムは存在しない。すべて PDF ファイルでの提供
- ページ ID・ファイル ID ともに不規則なハッシュ値のため、URL の推測による取得は不可能
- 必ずトップページ → 年度別ページ → PDF リンクの順にクロールする必要がある
- 平成12年の会議録一覧ページは存在しない可能性がある
- PDF のファイルサイズは 200KB〜1MB 程度

---

## 推奨アプローチ

1. **2段階クロール**: トップページから年度別ページ URL を収集し、各年度ページから PDF URL を収集する
2. **メタ情報の抽出**: HTML の見出し構造（`<h4>`, `<h5>`）とリンクテキストから会議種別・回次・開催日を取得する
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 年度別ページの URL リストを保持し、新年度ページが追加された場合のみ追加クロールを行う
