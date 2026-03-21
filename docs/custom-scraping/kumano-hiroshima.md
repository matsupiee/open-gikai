# 熊野町議会（広島県） カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kumano.hiroshima.jp/www/genre/1436489288629/index.html
- 分類: 町公式サイト内での直接公開（会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で提供。年度別にカテゴリページが分かれており、各年度の記事ページから PDF をダウンロードする構成。平成24年〜令和7年の会議録が公開されている。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.kumano.hiroshima.jp/www/genre/1436489288629/index.html` |
| 年度別カテゴリページ | `https://www.town.kumano.hiroshima.jp/www/genre/{ID}/index.html` |
| 年度別記事ページ（PDF 一覧） | `https://www.town.kumano.hiroshima.jp/www/contents/{ID}/index.html` |
| PDF ファイル | `https://www.town.kumano.hiroshima.jp/www/contents/{ID}/files/{ファイル名}.pdf` |

### 年度別カテゴリページ URL 一覧

| 年度 | カテゴリページ | 記事ページ |
| --- | --- | --- |
| 令和7年 | `/www/genre/1743419029473/index.html` | `/www/contents/1751953208630/index.html` |
| 令和6年 | `/www/genre/1712906230900/index.html` | `/www/contents/1710119246226/index.html` |
| 令和5年 | `/www/genre/1679882196376/index.html` | `/www/contents/1679892034278/index.html` |
| 令和4年 | `/www/genre/1649032048908/index.html` | `/www/contents/1647318727561/index.html` |
| 令和3年 | `/www/genre/1617238473147/index.html` | `/www/contents/1618272255975/index.html` |
| 令和2年 | `/www/genre/1584941147745/index.html` | `/www/contents/1584944659318/index.html` |
| 平成31年 | `/www/genre/1552995548802/index.html` | `/www/contents/1553046058421/index.html` |
| 平成30年 | `/www/genre/1519624275618/index.html` | `/www/contents/1520901626175/index.html` |
| 平成29年 | `/www/genre/1489458377724/index.html` | `/www/contents/1495679275703/index.html` |
| 平成28年 | `/www/genre/1459908400768/index.html` | `/www/contents/1461737770532/index.html` |
| 平成27年 | `/www/genre/1441105246451/index.html` | `/www/contents/1432187153540/index.html` |
| 平成26年 | `/www/genre/1436489463016/index.html` | `/www/contents/1409901681058/index.html` |
| 平成25年 | `/www/genre/1436489471256/index.html` | `/www/contents/1409904354152/index.html` |
| 平成24年 | `/www/genre/1436489484069/index.html` | `/www/contents/1409905030458/index.html` |

---

## ページ構造

### 会議録トップページ

- 年度ごとにセクション分けされ、各年度へのリンクが `<ul><li>` で表示
- 「さらに記事を表示」「記事を折りたたむ」による折りたたみ機能あり（初期表示は最新3件）
- パンくずリスト: ホーム > 議会 > 会議録

### 年度別記事ページ（PDF 一覧）

- 1年度 = 1記事ページに全会議録 PDF がまとめて掲載
- 会議種別ごとに太字見出し（`**【定例会・臨時会】**`、`**【全員協議会】**`、`**【特別委員会】**`）で区切り
- 各会議は「■」で列挙され、その下に PDF リンクが `<ul><li><a>` で配置
- PDF リンクテキスト形式: `{年度}年第{N}回熊野町議会{会議種別}（{日付 or 目次}）`

---

## 会議種別

令和6年の実績に基づく会議種別:

| 種別 | 内容 |
| --- | --- |
| 定例会 | 第1回〜第5回（年度による） |
| 臨時会 | 不定期開催（例: 令和6年第4回臨時会） |
| 全員協議会 | 第1回〜第8回程度 |
| 予算特別委員会 | 年1回 |
| 決算特別委員会 | 年1回 |

各会議は開催日ごとに個別の PDF として分割されている（例: 第1回定例会 = 目次 + 3月5日 + 3月6日 + 3月8日の4ファイル）。

---

## PDF ファイル名パターン

ファイル名はローマ字表記で統一性が低く、年度・回次によって命名規則が異なる:

```
# 令和6年の例
reiwa6dai1kaiteireikaikaigiroku1gou.pdf   # 第1回定例会
reiwa6dai1kaiteireikaimokuji.pdf           # 第1回定例会（目次）
reiwa6teireikai2mokuji.pdf                 # 第2回定例会（目次）
r6dai3mokuji.pdf                           # 第3回定例会（目次）- 省略形
reiwa6dai4rinnjimokuji.pdf                 # 第4回臨時会（目次）
reiwa6zennkyomokuji.pdf                    # 全員協議会（目次）
reiwa6yotokumokuji.pdf                     # 予算特別委員会（目次）
r6kessanmokuji.pdf                         # 決算特別委員会（目次）- 省略形
```

ファイル名の命名規則が不統一のため、ファイル名からメタ情報を抽出するのは困難。PDF リンクテキストからメタ情報を取得すること。

---

## スクレイピング戦略

### Step 1: 年度別記事ページ URL の収集

会議録トップページ `/www/genre/1436489288629/index.html` から年度別の記事ページ URL を収集する。

1. トップページの `<a href="/www/contents/{ID}/index.html">` リンクを抽出
2. 折りたたみ表示があるため、HTML 内に全件のリンクが含まれているか確認。含まれていない場合は各年度カテゴリページからも収集

**収集方法:**

```typescript
// トップページから記事ページ URL を抽出
const contentLinks = $('a[href*="/www/contents/"]')
  .map((_, el) => $(el).attr('href'))
  .get()
  .filter(href => href?.endsWith('/index.html'));
```

### Step 2: PDF リンクの収集

各年度の記事ページ `/www/contents/{ID}/index.html` にアクセスし、PDF ファイルへのリンクとそのリンクテキストを収集する。

```typescript
// PDF リンクとテキストの抽出
const pdfEntries = $('a[href$=".pdf"]').map((_, el) => ({
  url: $(el).attr('href'),
  text: $(el).text().trim(),
})).get();
```

### Step 3: メタ情報の抽出

PDF リンクテキストから以下のメタ情報を抽出する:

```
令和6年第1回熊野町議会定例会（3月5日）
令和6年第4回熊野町議会臨時会（目次）
令和6年第1回熊野町議会全員協議会（1月25日）
令和6年予算特別委員会
```

抽出パターン:

```typescript
// 定例会・臨時会・全員協議会のパターン
const meetingPattern = /^(令和|平成)(\d+)年第(\d+)回熊野町議会(定例会|臨時会|全員協議会)（(.+?)）$/;
// グループ: [1]元号, [2]年, [3]回, [4]会議種別, [5]日付or目次

// 特別委員会のパターン
const committeePattern = /^(令和|平成)(\d+)年(予算特別委員会|決算特別委員会)(目次)?$/;
// グループ: [1]元号, [2]年, [3]委員会名, [4]目次フラグ
```

### Step 4: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、PDF パーサー（pdf-parse 等）でテキストを抽出する。

- 目次 PDF はスキップ可能（会議録本文ではないため）
- 1つの定例会が複数日にわたる場合、日付ごとに別 PDF として公開されている

---

## 注意事項

- PDF ファイル名の命名規則が不統一のため、必ずリンクテキストからメタ情報を取得すること
- 「さらに記事を表示」の折りたたみは JavaScript 制御だが、HTML 内に全リンクが含まれている可能性がある。含まれていない場合は年度別カテゴリページ URL 一覧をハードコードして対応する
- 定例会の回次と臨時会の回次が通算で番号付けされている場合がある（例: 令和6年は第1〜3回・第5回が定例会、第4回が臨時会）
- 年度によって PDF の公開粒度が異なる可能性がある（古い年度は1定例会1ファイル等）
- リクエスト間には適切な待機時間（1〜2秒）を設けること

---

## 推奨アプローチ

1. **年度別 URL のハードコード**: 年度別記事ページの URL は数が限られている（14年度分）ため、URL 一覧をハードコードして確実に全件取得する
2. **リンクテキストからメタ情報を抽出**: PDF ファイル名ではなくリンクテキストから会議種別・日付等を取得する
3. **目次 PDF のスキップ**: リンクテキストに「目次」を含む PDF はスキップし、本文 PDF のみを処理する
4. **PDF テキスト抽出**: pdf-parse 等で PDF からテキストを抽出し、発言者・発言内容を構造化する
5. **差分更新**: 年度別ページの更新日と取得済み PDF URL を比較し、新規分のみ取得する
