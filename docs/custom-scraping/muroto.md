# 室戸市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.muroto.kochi.jp/navi/a02b08.php
- 分類: PDF 年別提供（議会・選挙ページから年別に会議録 PDF を直接ダウンロード）
- 文字コード: UTF-8
- 対象期間: 2009 年〜2025 年（17 年分）
- 特記: 会議録検索システムなし。年別ページ経由で PDF を直接配布。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会・選挙トップ | `https://www.city.muroto.kochi.jp/navi/a02b08.php` |
| 年別会議録一覧 | `https://www.city.muroto.kochi.jp/pages/page{ページID}.php` |
| PDF ファイル | `https://www.city.muroto.kochi.jp/pbfile/m{ページID}/pbf{タイムスタンプ}[_{ランダム文字列}].pdf` |

---

## 年別ページ ID 一覧

| 年 | 元号 | ページ URL |
| --- | --- | --- |
| 2025 | 令和 7 年 | `https://www.city.muroto.kochi.jp/pages/page3221.php` |
| 2024 | 令和 6 年 | `https://www.city.muroto.kochi.jp/pages/page2899.php` |
| 2023 | 令和 5 年 | `https://www.city.muroto.kochi.jp/pages/page2554.php` |
| 2022 | 令和 4 年 | `https://www.city.muroto.kochi.jp/pages/page2136.php` |
| 2021 | 令和 3 年 | `https://www.city.muroto.kochi.jp/pages/page1708.php` |
| 2020 | 令和 2 年 | `https://www.city.muroto.kochi.jp/pages/page1294.php` |
| 2019 | 平成 31・令和元年 | `https://www.city.muroto.kochi.jp/pages/page0974.php` |
| 2018 | 平成 30 年 | `https://www.city.muroto.kochi.jp/pages/page0981.php` |
| 2017 | 平成 29 年 | `https://www.city.muroto.kochi.jp/pages/page0987.php` |
| 2016 | 平成 28 年 | `https://www.city.muroto.kochi.jp/pages/page0997.php` |
| 2015 | 平成 27 年 | `https://www.city.muroto.kochi.jp/pages/page1003.php` |
| 2014 | 平成 26 年 | `https://www.city.muroto.kochi.jp/pages/page1023.php` |
| 2013 | 平成 25 年 | `https://www.city.muroto.kochi.jp/pages/page1031.php` |
| 2012 | 平成 24 年 | `https://www.city.muroto.kochi.jp/pages/page1042.php` |
| 2011 | 平成 23 年 | `https://www.city.muroto.kochi.jp/pages/page1047.php` |
| 2010 | 平成 22 年 | `https://www.city.muroto.kochi.jp/pages/page1053.php` |
| 2009 | 平成 21 年 | `https://www.city.muroto.kochi.jp/pages/page0952.php` |

---

## PDF ファイル命名規則

PDF ファイル名は以下の 2 パターンが混在する：

```
# パターン 1（旧形式）: タイムスタンプのみ
pbf{YYYYMMDDHHmmss}.pdf
例: pbf20091215134512.pdf

# パターン 2（新形式）: タイムスタンプ + ランダム文字列
pbf{YYYYMMDDHHmmss}_{12文字のランダム英数字}.pdf
例: pbf20250606112145_C0AMALt2V4VD.pdf
```

PDF の格納ディレクトリはページ ID に対応する：
```
/pbfile/m{ページID}/
例: /pbfile/m003221/ （2025年のページIDが3221の場合）
```

---

## 会議構成

各年の会議録は以下の構成で提供される：

### 定例会（年 4 回）

| 時期 | 会議名 |
| --- | --- |
| 3 月 | 第 N 回 定例会 |
| 6 月 | 第 N 回 定例会 |
| 9 月 | 第 N 回 定例会 |
| 12 月 | 第 N 回 定例会 |

### 臨時会（年 1〜4 回程度）

- 開催月・回数は年度により異なる
- 2 月・5 月・8 月・10 月・11 月に開催実績あり

### 各会議の PDF 構成

1 つの会議につき複数の PDF が提供される：

| ファイル種別 | 内容 |
| --- | --- |
| 目次 | 会議全体の目次 |
| 会期日程 | 会期の日程表（定例会のみ） |
| 一般質問順序・通告内容 | 一般質問の順序と通告（定例会のみ） |
| 第 N 号 | 開会・閉会を含む各日の会議録本文 |
| 資料 | 議案・決議案・修正案・陳情等の添付資料 |
| 議決結果一覧表 | 議決の結果まとめ |

---

## スクレイピング戦略

### Step 1: 年別ページから PDF リンクを収集

各年別ページ（`/pages/page{ID}.php`）にアクセスし、ページ内の PDF リンクをすべて抽出する。

- PDF リンクの相対パスは `../pbfile/m{ID}/pbf*.pdf` 形式
- 絶対 URL に変換: `https://www.city.muroto.kochi.jp/pbfile/m{ID}/pbf*.pdf`
- リンクテキストから会議名・ファイル種別を取得する

**収集方法:**

1. 上記「年別ページ ID 一覧」の全 URL を順番に処理
2. Cheerio で `a[href*=".pdf"]` を抽出
3. リンクテキストから会議名（「第 N 回 定例会」「第 N 回 臨時会」等）を特定
4. 前後の見出し要素（`h2`・`h3`・`strong` 等）から会議名を補完

### Step 2: PDF のダウンロードとテキスト抽出

収集した PDF URL から会議録本文 PDF（第 N 号）をダウンロードしてテキスト抽出する。

- 目次・会期日程・議決結果一覧表は本文ではないため取得対象外とする
- 一般質問順序・通告内容も本文 PDF ではないため取得対象外
- 資料 PDF は議案テキストが必要な場合のみ対象

### Step 3: 会議録のパース

#### メタ情報

PDF テキスト冒頭から以下を抽出する：

```
令和７年２月　室戸市議会第１回臨時会会議録（第１号）
```

- 開催年月: `令和X年X月` または `平成X年X月`
- 会議名: `第N回 定例会` または `第N回 臨時会`
- 号数: `第N号`

#### 発言の構造

```
議長（氏名）
副議長（氏名）
N番（氏名）
市長（氏名）
副市長（氏名）
教育長（氏名）
○○部長（氏名）
```

- 発言者と発言内容が段落単位で区切られる
- 採決・表決等の定型文も含まれる

---

## 注意事項

- PDF はすべて画像ではなくテキスト埋め込み形式（OCR 不要）
- ファイル名に意味的な情報は含まれない（タイムスタンプのみ）
- 各会議の号数（第 1 号〜第 N 号）は定例会で複数日分に分かれる
- 2019 年は平成 31 年・令和元年をまたぐため、元号変換に注意
- レート制限: リクエスト間に 1〜2 秒の待機時間を設ける

---

## 推奨アプローチ

1. **年別ページを起点にする**: 年別ページ ID は固定されており、トップページから辿る必要はない
2. **会議録本文 PDF に絞る**: 「第 N 号」と明記されたリンクを優先取得し、目次・日程・資料は後回し
3. **リンクテキストを活用**: PDF 格納先に意味的情報がないため、HTML のリンクテキストから会議名・種別を取得する
4. **差分更新**: 各年別ページの更新日（ページ末尾に記載）を記録し、前回取得日以降に更新されたページのみを再取得する

---

## 問い合わせ先

室戸市議会事務局
電話: 0887-22-5140
