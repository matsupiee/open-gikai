# 四万十町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shimanto.lg.jp/gijiroku/
- 分類: カスタム開発の会議録検索システム（独自 PHP）
- 文字コード: UTF-8
- 特記: Google Analytics（gtag）使用、年度切り替えはフォーム送信による動的表示

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| トップ（開催別） | `https://www.town.shimanto.lg.jp/gijiroku/` |
| 会議録カテゴリ一覧 | `https://www.town.shimanto.lg.jp/gijiroku/?hdnKatugi=130` |
| 検索ページ | `https://www.town.shimanto.lg.jp/gijiroku/giji_search.php?hdnKatugi=999999` |
| 開催別詳細 | `https://www.town.shimanto.lg.jp/gijiroku/giji_kaisai.php?hdnID={開催ID}` |
| 文書詳細 | `https://www.town.shimanto.lg.jp/gijiroku/giji_dtl.php?hdnFlg=9&hdnID={文書ID}` |
| 文書詳細（カテゴリ経由） | `https://www.town.shimanto.lg.jp/gijiroku/giji_dtl.php?hdnKatugi=130&hdnID={文書ID}` |

---

## パラメータ

### hdnKatugi（文書カテゴリ）

| 値 | カテゴリ |
| --- | --- |
| `10` | 議案書 |
| `30` | 一般質問通告書 |
| `50` | 所信表明・行政報告 |
| `110` | 議決書目次 |
| `130` | 会議録 |
| `999999` | 検索 |

### hdnID（文書 ID）

各文書に一意に振られた数値 ID。開催別ページ（`giji_kaisai.php`）や会議録カテゴリ一覧（`?hdnKatugi=130`）から取得できる。

### 年度切り替え（hdnYear / hdngo）

会議録カテゴリ一覧ページでは年度タブがフォーム送信で動的に切り替わる。

```javascript
function fncYearSet(parm1, parm2) {
  document.form.hdngo.value = parm1;
  document.form.hdnYear.value = parm2;
  document.form.submit();
}
```

- `hdnYear`: 表示する年度
- `hdngo`: 遷移先の指定（詳細不明）
- 送信方法: 通常のフォーム POST

---

## 検索パラメータ

検索ページ（`giji_search.php`）のフォーム要素:

| フィールド名 | 用途 |
| --- | --- |
| `selKbn` | 区分（全て / 議案書 / 会議録 / 意見書 等） |
| `txtQ` | 質問者名 |
| `txtA` | 答弁者名 |
| `txtWord1` | 検索キーワード 1 |
| `txtWord2` | 検索キーワード 2 |
| `txtWord3` | 検索キーワード 3 |

- 条件 1〜4 は全て AND 条件で接続
- 検索ワード内は AND/OR 切り替え可能
- 最低 1 つの検索条件が必須（`fncEnter()` でバリデーション）

---

## データ範囲

平成 18 年（2006 年）〜 現在（令和 8 年）。年度タブが約 20 年分存在する。

---

## スクレイピング戦略

### Step 1: 開催 ID の収集

開催別トップページ（`/gijiroku/`）から全年度の開催一覧を取得する。

**方法:**

1. 会議録カテゴリ一覧（`?hdnKatugi=130`）にアクセス
2. 各年度について `fncYearSet()` 相当のフォーム POST で年度を切り替え
3. 各年度ページから `giji_dtl.php?hdnKatugi=130&hdnID={ID}` のリンクを抽出
4. hdnID を収集

**代替方法（開催別経由）:**

1. トップページ（`/gijiroku/`）から各開催の `giji_kaisai.php?hdnID={開催ID}` を取得
2. 各開催ページから会議録文書の `giji_dtl.php?hdnFlg=9&hdnID={文書ID}` を抽出

### Step 2: 会議録本文の取得

`giji_dtl.php?hdnKatugi=130&hdnID={ID}` または `giji_dtl.php?hdnFlg=9&hdnID={ID}` で会議録詳細ページを取得する。

- 本文はプレーンテキスト形式で HTML 内に直接埋め込まれている
- PDF 添付ファイル（目次 + 本文）も存在するが、HTML 本文のパースが推奨

### Step 3: 会議録のパース

#### メタ情報

ページ上部から以下を抽出:

```
会議録 令和８年 » 令和８年第１回臨時会(開催日:2026/01/29)
```

- 会議名: `令和X年第Y回{定例会|臨時会}`
- 開催日: `開催日:YYYY/MM/DD` 形式

#### 出席情報

```
出席議員（14名）
  １番 武田秀義君
  ２番 山本大輔君
  ...
```

- 出席議員数と欠席議員数
- 説明員（町長、副町長、各課長等）
- 事務局職員

#### 発言の構造

発言者パターン:

```
○議長（緒方正綱君）
○町長（中尾博憲君）
○議会運営委員長（味元和義君）
○４番（村井眞菜君）
○企画課長（冨田努君）
○教育次長（川上武史君）
○にぎわい創出課長（小笹義博君）
○11番（下元真之君）
```

- `○` で始まり、役職 or 議員番号 + 括弧内に氏名 + 敬称（君）
- 敬称は「君」が使用される

#### セクション区切り

```
～～～～～～～～～～～～～～～
```

チルダの連続で議題間を区切る。

#### パース用正規表現（案）

```typescript
// 発言者の抽出
const speakerPattern = /^○(.+?)（(.+?)君?）/;
// 例: ○４番（村井眞菜君） → role="４番", name="村井眞菜"
// 例: ○議長（緒方正綱君） → role="議長", name="緒方正綱"

// 開催日の抽出
const datePattern = /開催日[:：](\d{4})\/(\d{2})\/(\d{2})/;

// セクション区切りの検出
const sectionSeparator = /^～{5,}$/;

// 会議名の抽出
const meetingPattern = /(令和|平成)\d+年第\d+回(定例会|臨時会)/;
```

---

## PDF 添付ファイル

各会議録には PDF 添付ファイル（目次 + 本文）が存在する:

```
../data/fd_10file/downfile64692.pdf
```

- パス形式: `../data/fd_10file/downfile{番号}.pdf`
- 目次と本文が別ファイルで提供される
- HTML 本文が取得できない場合のフォールバックとして利用可能

---

## 注意事項

- 年度タブの切り替えはフォーム POST であり、単純な GET リクエストでは取得できない
- `hdngo` と `hdnYear` の hidden フィールドを POST で送信する必要がある
- 検索機能では全角・半角の区別がある可能性あり
- 議員番号は全角（○４番）と半角（○11番）が混在している

---

## 推奨アプローチ

1. **会議録カテゴリ経由で ID 収集**: `?hdnKatugi=130` のページにフォーム POST で年度を順次切り替え、全年度の会議録 hdnID を収集
2. **HTML 本文をパース**: PDF ではなく HTML ページから直接テキストを抽出（構造化されており機械処理に適する）
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: hdnID は数値連番のため、前回取得済みの最大 ID 以降のみを取得する差分更新が可能
