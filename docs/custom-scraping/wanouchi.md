# 輪之内町議会 カスタムスクレイピング方針

## 概要

- サイト: https://town.wanouchi.gifu.jp/portal/town/parliament/kaigiroku-parliament/
- 分類: WordPress による自治体公式サイト（会議録は PDF ファイルで公開）
- 文字コード: UTF-8
- 特記: 検索機能なし。年度別アーカイブページから PDF を直接ダウンロードする形式。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年度一覧 | `https://town.wanouchi.gifu.jp/portal/town/parliament/kaigiroku-parliament/` |
| 年度別詳細 | `https://town.wanouchi.gifu.jp/portal/town/parliament/kaigiroku-parliament/{post番号}/` |
| 会議録 PDF | `https://town.wanouchi.gifu.jp/wp-content/uploads/gikai{YYMMdd}.pdf` |

### 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和8年（2026年） | `/portal/town/parliament/kaigiroku-parliament/post0067055/` |
| 令和7年（2025年） | `/portal/town/parliament/kaigiroku-parliament/post0065197/` |
| 令和6年（2024年） | `/portal/town/parliament/kaigiroku-parliament/post0060279/` |
| 令和5年（2023年） | `/portal/town/parliament/kaigiroku-parliament/post0046805/` |
| 令和4年（2022年） | `/portal/town/parliament/kaigiroku-parliament/post0045712/` |
| 令和3年（2021年） | `/portal/town/parliament/kaigiroku-parliament/post0035164/` |
| 令和2年（2020年） | `/portal/town/parliament/kaigiroku-parliament/post0026300/` |
| 平成31年・令和元年（2019年） | `/portal/town/parliament/kaigiroku-parliament/post0026115/` |
| 平成30年（2018年） | `/portal/town/parliament/kaigiroku-parliament/post0026125/` |
| 平成29年（2017年） | `/portal/town/parliament/kaigiroku-parliament/post0026133/` |
| 平成28年（2016年） | `/portal/town/parliament/kaigiroku-parliament/post0026150/` |
| 平成27年（2015年） | `/portal/town/parliament/kaigiroku-parliament/post0026166/` |
| 平成26年（2014年） | `/portal/town/parliament/kaigiroku-parliament/post0026200/` |
| 平成25年（2013年） | `/portal/town/parliament/kaigiroku-parliament/post0026217/` |
| 平成24年（2012年） | `/portal/town/parliament/kaigiroku-parliament/post0026239/` |
| 平成23年（2011年） | `/portal/town/parliament/kaigiroku-parliament/post0026254/` |
| 平成22年（2010年） | `/portal/town/parliament/kaigiroku-parliament/post0026276/` |

---

## 検索パラメータ

検索機能は提供されていない。年度別ページに会議録 PDF へのリンクが直接掲載されている。

---

## PDF ファイル命名規則

```
gikai{年号2桁}{月2桁}{日2桁}.pdf
```

- 令和7年3月3日開会 → `gikai250303.pdf`
- 令和8年1月20日開会 → `gikai260120.pdf`

年号は元号の年数を2桁で表記する（令和7年 → 25、令和8年 → 26）。

---

## スクレイピング戦略

### Step 1: 年度別ページから PDF URL の収集

年度一覧ページ（`/kaigiroku-parliament/`）の `<ul>` リスト内の `<a>` タグから各年度ページの URL を取得する。

次に各年度詳細ページをフェッチし、`<a href="...gikai*.pdf">` のパターンで PDF へのリンクを抽出する。

**収集方法:**

1. 年度一覧ページをフェッチし、`/kaigiroku-parliament/post\d+/` にマッチするリンクを収集
2. 各年度ページをフェッチし、`wp-content/uploads/gikai\d+\.pdf` にマッチするリンクを収集
3. 取得した PDF URL を全量リストとして管理

### Step 2: PDF のダウンロードとテキスト抽出

PDF は `pdftotext` 等のツールでテキスト抽出を行う。

- CubePDF + iTextSharp で生成された PDF-1.7 形式
- テキストレイヤーは正常に抽出可能
- A4 サイズ、1会議あたり数十〜200ページ程度

### Step 3: PDF のパース

#### メタ情報

PDF 冒頭から以下を抽出する:

```
令和７年

第１回定例輪之内町議会会議録

令和 ７ 年 ３ 月 ３ 日    開会
令和 ７ 年 ３ 月 14 日    閉会
```

- 年度: 冒頭行の元号表記
- 会議名: 「第N回定例輪之内町議会」または「第N回臨時輪之内町議会」
- 開会日・閉会日: 元号年月日形式

#### 会議種別

年4回の定例会（3月・6月・9月・12月）と臨時会（不定期）が存在する。

| 種別 | 表記 |
| --- | --- |
| 定例会 | `第N回定例輪之内町議会` |
| 臨時会 | `第N回臨時輪之内町議会` |

#### 発言の構造

発言者は `○` で始まる行で識別される。

```
○議長（上野賢二君）
○副町長（荒川 浩君）
○町長（朝倉和仁君）
○教育長（長屋英人君）
○９番（田中政治君）
○５番（浅野 進君）
○企画財政商工課長（菱田靖雄君）
○文教厚生常任委員長（林 日出雄君）
○人口減少対策特別委員長（大橋慶裕君）
```

パターン: `○{役職名}（{氏名}君）`

- 議員は番号（`N番`）で識別され、括弧内に氏名
- 議長・副町長・町長・教育長等は役職名で識別
- 課長・主幹等の行政職員も発言者として登場
- 委員長は委員会名 + 委員長として表記
- 氏名末尾には「君」が付く

#### 動作・声の表記

発言者行以外にも、議事の動作・声を示す括弧表記が挿入される。

```
（「異議なし」の声あり）
（午前10時05分 休憩）
（午前10時20分 再開）
（挙手する者あり）
（「議長」の声あり）
```

これらは発言としてパースしない。

#### パース用正規表現（案）

```typescript
// 発言者の抽出
const speakerPattern = /^○(.+?)（(.+?)君）/;
// 例: ○９番（田中政治君） → role="９番", name="田中政治"
// 例: ○町長（朝倉和仁君） → role="町長", name="朝倉和仁"

// 動作・声の検出（発言として扱わない）
const actionPattern = /^（.+）$/;

// 開催日の抽出
const datePattern = /(?:令和|平成)\s*(\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/;

// 会議名の抽出
const sessionPattern = /第([\d０-９]+)回(定例|臨時)輪之内町議会/;
```

---

## 注意事項

- 年度一覧ページの post 番号は連番ではなく不規則なため、固定リストを使用する
- 年度ページ内に「関連情報」として前後年度へのリンクが含まれるが、年度一覧ページから全量を取得する方が確実
- PDF ファイル名の年号は元号年数（令和7年 → 25）のため、西暦変換が必要
- 一つの定例会が複数日にまたがる場合（例: 3月3日〜3月14日）でも、PDF は1ファイルにまとめられている
- 氏名に半角スペースが含まれる場合がある（例: `浅野 進`、`荒川 浩`）

---

## 推奨アプローチ

1. **固定 URL リストを使用**: 年度別ページの URL は固定リストとして管理し、新年度追加時に更新する
2. **PDF リンクの正規表現**: `href` 属性から `gikai\d+\.pdf` パターンで抽出
3. **pdftotext でテキスト抽出**: テキストレイヤーが正常に存在するため `pdftotext` で抽出可能
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2秒）を設ける
5. **差分更新**: 既取得の PDF ファイル名リストと照合し、新規 PDF のみをダウンロードする
