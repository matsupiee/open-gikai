# 多度津町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/index.html
- 分類: PDF 形式による年度別公開（専用検索システムなし）
- 対象期間: 平成25年（2013年）〜 令和7年（2025年）
- 特記: 専用の会議録検索システムは存在せず、年度別一覧ページから PDF を直接ダウンロードする形式

---

## URL 構造

### 一覧ページ

| ページ | URL |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/index.html` |

### 年度別ページ

各年度は独立した HTML ページとして公開されている。URL の末尾の数値は年度ごとに異なる固定 ID。

| 年度 | URL |
| --- | --- |
| 令和7年（2025年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/3720.html` |
| 令和6年（2024年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/3190.html` |
| 令和5年（2023年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2872.html` |
| 令和4年（2022年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2387.html` |
| 令和3年（2021年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2291.html` |
| 令和2年（2020年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2290.html` |
| 令和元年（2019年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2289.html` |
| 平成30年（2018年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2288.html` |
| 平成29年（2017年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2287.html` |
| 平成28年（2016年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2286.html` |
| 平成27年（2015年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2285.html` |
| 平成26年（2014年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/2283.html` |
| 平成25年（2013年） | `https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/1806.html` |

---

## PDF ファイルのリンクパターン

全 PDF は以下のベース URL 配下に格納されている：

```
https://www.town.tadotsu.kagawa.jp/material/files/group/13/[ファイル名].pdf
```

### ファイル命名規則

ファイル名は `{年度省略記号}{月}{内容略号}.pdf` 形式が基本だが、**年度・担当者によって命名が揺れている**。以下は令和6〜7年のパターン例。

| 内容 | ファイル名の例 |
| --- | --- |
| 議案審議 | `0712gianshingi.pdf`、`0621giannsinngi.pdf` |
| 一般質問 | `0712ippan.pdf`、`0709ippan1.pdf`、`0611ippannsitumonn.pdf` |
| 提案説明 | `0712teian.pdf`、`0604teiannsetumei.pdf` |
| 臨時会 | `0703rinzikai.pdf`、`060130rinji.pdf` |
| 議員別個別質問 | `07121001furukawa.pdf`（年度+月+連番+議員姓） |

**注意**: ファイル名に一貫したルールがないため、年度別 HTML ページの `<a href>` から都度 PDF リンクを収集する必要がある。

---

## 会議録の形式

### PDF の性質

- **テキスト抽出可能な PDF**（スキャン画像ではない）
- 作成ツール: Microsoft Word LTSC
- フォント: MS-Mincho（TrueType）、YuMincho-Regular
- エンコーディング: Identity-H（Unicode 準拠）、ToUnicode マッピングあり
- 圧縮: FlateDecode

`pdftotext` や `pdf-parse` 等の標準的な PDF パーサーでテキスト抽出が可能。

### 会議種別

各年度で以下の会議録が公開されている：

| 種別 | 時期 | 内容 |
| --- | --- | --- |
| 第1回定例会 | 3月 | 議案審議、一般質問、提案説明 |
| 第2回定例会 | 6月 | 議案審議、一般質問（1〜2日）、提案説明 |
| 第3回定例会 | 9月 | 議案審議、一般質問（1〜2日）、提案説明 |
| 第4回定例会 | 12月 | 議案審議、一般質問（1〜2日）、提案説明 |
| 臨時会 | 随時 | 年1〜3回程度 |

一般質問は 1〜2 日に分割されることが多く、議員ごとの個別 PDF が別途提供される場合もある。

---

## スクレイピング戦略

### Step 1: 年度別ページから PDF リンクを収集

トップページ（index.html）の `<a href>` から全年度の URL リストを取得し、各年度ページを順に取得して PDF リンクを抽出する。

```
index.html
  └─ /kaigiroku/3720.html  （令和7年）
       └─ material/files/group/13/0712gianshingi.pdf
       └─ material/files/group/13/0712ippan.pdf
       └─ ...
  └─ /kaigiroku/3190.html  （令和6年）
       └─ ...
```

年度別ページの URL は連番ではなく不規則な固定 ID のため、**動的に取得するかハードコードして管理する**。

### Step 2: PDF のダウンロードとテキスト抽出

各 PDF を順次ダウンロードし、`pdftotext` または `pdf-parse` でテキストを抽出する。

- ファイルサイズは 300KB〜1.3MB 程度
- テキスト抽出後は不要な PDF バイナリを削除してよい

### Step 3: メタ情報のパース

#### 開催情報の取得元

PDF 内のテキストから以下を抽出する（年度別 HTML ページにも会議名・日付が記載されている場合がある）：

- 開催年月日
- 会議種別（定例会・臨時会）
- 回数（第X回）

#### 発言構造

Microsoft Word から変換された PDF であり、発言者と発言内容が段落単位で区切られていると推定される。具体的なパターンは各年度のサンプル PDF を実際に解析して確認すること。

---

## 注意事項

- **ファイル名の命名揺れ**: 同じ「一般質問」でも `ippan`、`ippan1`、`ippanshitumon`、`ippannsitumonn` など表記が年度・担当者によって異なる。必ず HTML ページから動的に href を収集する
- **プロトコルの混在**: 一部の年度ページは `http://` で参照されている（例: 令和6年）。`https://` に統一して取得する
- **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
- **年度 ID の管理**: 年度別ページの ID（3720、3190 等）は URL から推測できないため、トップページから毎回動的に取得するか、上記の対応表でハードコード管理する

---

## 推奨アプローチ

1. **トップページから年度リストを動的取得**: `index.html` を取得し、年度別ページの href を Cheerio 等で抽出する
2. **各年度ページから PDF リンクを収集**: `material/files/group/13/*.pdf` のパターンにマッチする href を全て収集する
3. **PDF をダウンロードしてテキスト抽出**: テキスト抽出可能な PDF のため、`pdf-parse` 等でそのまま処理できる
4. **差分更新**: 取得済みの PDF URL をキャッシュし、新規追加分のみ処理する
