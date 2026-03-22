# 積丹町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shakotan.lg.jp/contents/content0730.html
- 分類: 町公式サイト（Movable Type CMS）に PDF を掲載する形式
- 文字コード: UTF-8（HTML）、PDF 内テキストは日本語
- 特記: 会議録（逐語録）ではなく「会議の結果」（議決結果・一般質問の概要）を PDF で公開

---

## サイト構造

### 階層構成

```
議会トップ（content0730.html）
  └── 年度別一覧ページ（HTML）
        └── 各定例会・臨時会の結果（PDF）
```

### URL パターン

| ページ | URL パターン | 例 |
| --- | --- | --- |
| 議会トップ（年度一覧） | `https://www.town.shakotan.lg.jp/contents/content0730.html` | - |
| 年度別ページ | `https://www.town.shakotan.lg.jp/contents/{slug}.html` | `post-179.html`（R7）、`6.html`（R6） |
| 会議結果 PDF | `https://www.town.shakotan.lg.jp/contents/{hash}.pdf` | `e4a8a0f8d7aa31391bad3fd9e0905e90a5357571.pdf` |

---

## 年度別ページ一覧

トップページ（content0730.html）から取得できる年度別リンク:

| 年度 | URL |
| --- | --- |
| 令和8年 | `https://www.town.shakotan.lg.jp/contents/post-212.html` |
| 令和7年 | `https://www.town.shakotan.lg.jp/contents/post-179.html` |
| 令和6年 | `https://www.town.shakotan.lg.jp/contents/6.html` |
| 令和5年 | `https://www.town.shakotan.lg.jp/contents/post-122.html` |
| 令和4年 | `https://www.town.shakotan.lg.jp/contents/post-80.html` |
| 令和3年 | `https://www.town.shakotan.lg.jp/contents/post-57.html` |
| 令和2年 | `https://www.town.shakotan.lg.jp/contents/post-19.html` |
| 平成31年（令和元年） | `/contents/content0738.html` |
| 平成30年 | `/contents/content0726.html` |
| 平成29年 | `/contents/content0725.html` |
| 平成28年 | `/contents/content0524.html` |
| 平成27年 | `/contents/content0456.html` |
| 平成26年 | `/contents/content0455.html` |
| 平成25年 | `/contents/content0447.html` |
| 平成24年 | `/contents/content0448.html` |
| 平成23年 | `/contents/content0449.html` |
| 平成22年 | `/contents/content0450.html` |
| 平成21年 | `/contents/content0451.html` |
| 平成20年 | `/contents/content0452.html` |

※ URL のスラッグに規則性がなく、年度が追加されるたびに新しいページが作成される。

---

## PDF の内容と構造

PDF は「会議の結果」であり、逐語的な会議録（発言録）ではない。

### 含まれる情報

- 定例会・臨時会の日程（開催日・期間）
- 議案一覧と議決結果（原案可決・承認など）
- 一般質問のテーマと質問者名
- 行政報告・教育行政報告の有無

### PDF 内テキスト構造の例

```
令和７年第４回積丹町議会定例会の結果
■ 定例会日程
令和７年１２月１６日（火）～令和７年１２月１８日（木）

一般質問
  移住・定住対策について          【岩本幹兒議員】
  独居高齢者対策について          【岩本幹兒議員】
  一連の熊騒動について            【田村雄一議員】

議案第１号  積丹町公告式条例の一部改正について  令和７年12月１６日  原案可決
```

### PDF ファイル名の特徴

- ハッシュ値ベースのファイル名（例: `e4a8a0f8d7aa31391bad3fd9e0905e90a5357571.pdf`）
- ファイル名から会議種別・日付を推測することは不可能
- リンクテキストから会議情報を取得する必要がある

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `content0730.html` の `<div class="richtext">` 内から年度別ページへのリンクを抽出する。

- `<ul>` 内の `<a>` タグの `href` 属性を取得
- リンクテキストから年度情報を抽出（例: 「令和７年」「平成３１年（令和元年）」）

### Step 2: PDF URL の収集

各年度別ページの `<div class="richtext">` 内から PDF リンクを抽出する。

- `<a>` タグの `href` 属性が `.pdf` で終わるものを収集
- リンクテキストから会議種別（定例会/臨時会）と回次を抽出
- 一部の PDF は相対パスで記載されている場合がある（例: `f674f1c325b9b945fa6853a707a4423a727b27ca.pdf`）

**リンクテキストのパターン:**

```
令和{N}年第{M}回積丹町議会定例会の結果
令和{N}年第{M}回積丹町議会臨時会の結果
```

### Step 3: PDF のダウンロードとテキスト抽出

- PDF をダウンロードし、`pdftotext` 等でテキスト抽出する
- 表形式のレイアウトが含まれるため、テキスト抽出時に列の位置がずれる可能性がある

### Step 4: テキストのパース

#### メタ情報の抽出

```
令和７年第４回積丹町議会定例会の結果
```

- 年号・回次・会議種別（定例会/臨時会）を正規表現で抽出

#### 一般質問の抽出

```
一般質問  {質問テーマ}  【{議員名}議員】
```

- 質問テーマと質問者名を抽出

#### 議案・議決結果の抽出

```
議案第{N}号  {議案名}  {議決日}  {結果}
```

- 議案番号・議案名・議決日・結果を抽出

#### パース用正規表現（案）

```typescript
// 会議タイトルの抽出
const titlePattern = /(?:令和|平成)[０-９\d]+年第[０-９\d]+回積丹町議会(定例会|臨時会)の結果/;

// 一般質問者の抽出
const questionPattern = /【(.+?)議員】/;

// 議案の抽出
const billPattern = /議\s*案\s*第\s*([０-９\d]+)\s*号\s+(.+?)\s+(?:令和|平成).+?\s+(原案可決|承\s*認|否決|撤回)/;
```

---

## 注意事項

- 公開されているのは「会議の結果」（議決結果の概要）であり、発言の逐語録（会議録）ではない
- PDF のファイル名はハッシュ値のため、ファイル名から内容を判別できない
- 年度別ページの URL スラッグに規則性がないため、トップページからのリンク収集が必須
- 一部の PDF リンクが相対パスで記載されている場合がある（ベース URL の付与が必要）
- PDF は表形式のレイアウトを含むため、テキスト抽出の精度に注意が必要
- 平成20年から現在まで約18年分のデータが存在する

---

## 推奨アプローチ

1. **2段階クロール**: トップページ → 年度別ページ → PDF URL の順に収集する
2. **リンクテキスト活用**: PDF ファイル名からは情報が得られないため、HTML 上のリンクテキストからメタ情報を取得する
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 新しい年度ページの追加やPDF の追加を検出して差分更新する（トップページのリンク数で判定可能）
5. **PDF テキスト抽出**: `pdftotext` でテキスト化した後、表形式のレイアウト崩れを考慮してパースする
