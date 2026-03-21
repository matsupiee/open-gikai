# 川本町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/
- 分類: 公式ウェブサイト内で年度別に議事録を PDF 形式で提供（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は全て PDF ファイルで提供。HTML 本文としての会議録テキストは存在しない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/` |
| 年度別議事録ページ | `https://www.town.shimane-kawamoto.lg.jp/gyosei/town_administration/kawamoto_council/kaigiroku/{ページID}` |
| PDF ファイル | `https://www.town.shimane-kawamoto.lg.jp/files/original/{タイムスタンプ+ハッシュ}.pdf` |

### 年度別ページ ID 一覧

| 年度 | ページ ID |
| --- | --- |
| 令和7年（2025） | `7048` |
| 令和6年（2024） | `6075` |
| 令和5年（2023） | `5306` |
| 令和4年（2022） | `4907` |
| 令和3年（2021） | `4770` |
| 令和2年（2020） | `4618` |
| 平成31年・令和元年（2019） | `4274` |
| 平成30年（2018） | `4052` |
| 平成29年（2017） | `3844` |
| 平成28年（2016） | `3641` |
| 平成27年（2015） | `h27gijiroku` |
| 平成26年（2014） | `h26gijiroku` |
| 平成25年（2013） | `h25gijiroku` |
| 平成24年（2012） | `h24gijiroku` |

---

## サイト構造

### 2 階層構成

1. **会議録一覧ページ**: 年度別リンクの一覧（14 年度分、ページネーションなし）
2. **年度別議事録ページ**: 各年度の定例会・臨時会ごとに PDF リンクを掲載

### 年度別ページの HTML 構造

```html
<div class="com-section com-clearfix">
  <div class="contentBody">
    <h2>定例会</h2>
    <h3>第1回定例会</h3>
    <p>
      <a href="/files/original/{hash}.pdf" target="_blank" rel="noopener">令和7年3月7日：初日</a>
      <br>
      <a href="/files/original/{hash}.pdf" target="_blank" rel="noopener">令和7年3月11日：2日目</a>
    </p>
    <p><strong>一般質問</strong></p>
    <p>
      <a href="/files/original/{hash}.pdf" target="_blank" rel="noopener">令和7年3月12日：木村議員</a>
      <br>
      <a href="/files/original/{hash}.pdf" target="_blank" rel="noopener">令和7年3月12日：本山議員</a>
    </p>
    <h2>臨時会</h2>
    <h3>第3回臨時会</h3>
    <p>
      <a href="/files/original/{hash}.pdf" target="_blank" rel="noopener">令和7年第3回臨時会議事録</a>
    </p>
  </div>
</div>
```

### 会議の種類

- **定例会**: 年4回（第1回〜第4回）。初日・一般質問（議員別）・最終日に分割
- **臨時会**: 年に複数回。単一 PDF で提供

### PDF リンクテキストのパターン

- 定例会初日/最終日: `令和X年M月D日：初日` / `令和X年M月D日：最終日`
- 定例会2日目以降: `令和X年M月D日：2日目`
- 一般質問: `令和X年M月D日：{議員名}議員` または `令和X年M月D日：{議員名}`
- 臨時会: `令和X年第N回臨時会議事録`

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

会議録一覧ページから年度別ページへのリンクを抽出する。

- CSS セレクタ: `a[href*="/kaigiroku/"]` でリンクを取得
- ページ ID は数値（`7048` 等）またはスラッグ（`h27gijiroku` 等）
- 全 14 年度分が 1 ページに表示される（ページネーションなし）

### Step 2: 各年度ページから PDF URL の収集

年度別ページの `.contentBody` 内から PDF リンクを抽出する。

**収集方法:**

1. 各年度ページを取得
2. `a[href$=".pdf"]` で PDF リンクを全て抽出
3. リンクテキストから以下のメタ情報をパース:
   - 開催日（`令和X年M月D日` 形式）
   - 会議区分（定例会/臨時会）: 直前の `<h2>` から判定
   - 回次（第N回）: 直前の `<h3>` から判定
   - 議事内容（初日/最終日/議員名）: リンクテキストから抽出

**パース用正規表現（案）:**

```typescript
// 定例会・臨時会の日付＋内容
const linkTextPattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日[：:](.+)/;
// 例: 令和7年3月7日：初日 → year="7", month="3", day="7", content="初日"

// 臨時会パターン
const rinjiPattern = /(?:令和|平成)(\d+)年第(\d+)回臨時会議事録/;
// 例: 令和7年第3回臨時会議事録 → year="7", session="3"

// 会議区分の判定（h2 テキストから）
const meetingTypePattern = /^(定例会|臨時会)$/;

// 回次の判定（h3 テキストから）
const sessionPattern = /第(\d+)回(定例会|臨時会)/;
```

### Step 3: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、テキストを抽出する。

- PDF URL パターン: `/files/original/{タイムスタンプ+ハッシュ}.pdf`
- 完全 URL: `https://www.town.shimane-kawamoto.lg.jp/files/original/{hash}.pdf`
- PDF からのテキスト抽出には `pdf-parse` 等のライブラリを使用

---

## 注意事項

- 会議録は全て PDF 形式で提供されており、HTML テキストとしての本文は存在しない
- PDF からのテキスト抽出精度はファイルにより異なる可能性がある（スキャン PDF の場合は OCR が必要）
- 一般質問の画像（一般質問者一覧表）は JPG で提供されている（`/images/original/{hash}.jpg`）
- 一部のリンクテキストが複数の `<a>` タグに分割されている場合がある（同一 href で分割）
- ページ ID の命名規則が途中で変更されている（平成27年以前: `h{年}gijiroku`、平成28年以降: 数値）
- 検索機能・ページネーションは存在しない

---

## 推奨アプローチ

1. **全量取得を優先**: 一覧ページから全 14 年度の URL を取得し、各年度ページから PDF URL を網羅的に収集
2. **PDF テキスト抽出**: ダウンロードした PDF に対して `pdf-parse` 等でテキスト抽出を実施。スキャン PDF の場合は OCR 処理を検討
3. **メタ情報のパース**: リンクテキストと HTML 構造（h2/h3）から会議区分・回次・日付・議事内容を構造化
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 年度別ページ ID が既知のため、新年度のページが追加された際は一覧ページを再取得して新しいページ ID を検出する
