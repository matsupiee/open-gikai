# 大空町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/
- 分類: 自治体公式サイトで PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録はすべて PDF ファイルで提供。HTML 上の本文テキストはなし

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/` |
| 本会議トップ | `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/1/index.html` |
| 本会議会議録一覧（最新：平成28年〜） | `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/1/1/2213.html` |
| 本会議会議録一覧（年度別：平成18〜27年） | `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/1/1/{ページID}.html` |
| 委員会トップ | `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/2/index.html` |
| 委員会等会議概要 | `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/2/2215.html` |
| PDF ファイル | `https://www.town.ozora.hokkaido.jp/material/files/group/21/{ファイル名}.pdf` |

### 本会議会議録一覧ページ（年度別）

| ページID | 対象年度 |
| --- | --- |
| `2213` | 最新（平成28年〜令和6年） |
| `2259` | 平成27年 |
| `2242` | 平成26年 |
| `2241` | 平成25年 |
| `2240` | 平成24年 |
| `2239` | 平成23年 |
| `2238` | 平成22年 |
| `2237` | 平成21年 |
| `2236` | 平成20年 |
| `2235` | 平成19年 |
| `2234` | 平成18年 |

---

## PDF ファイルの命名規則

PDF ファイルは `/material/files/group/21/` 配下に格納されており、命名規則は年度によって異なる。

### 令和年度（近年）

```
r{和暦年}-{回}teireikai.pdf      # 定例会
r{和暦年}-{回}rinnjikai.pdf      # 臨時会（表記揺れあり: rinjikai, rinnji）
r{和暦年}-yosannsihinsa.pdf      # 予算審査特別委員会（表記揺れあり）
r{和暦年}-kessanshinsa.pdf       # 決算審査特別委員会
```

例:
- `r6-1teireikai.pdf` — 令和6年第1回定例会
- `r6-2rinnjikai.pdf` — 令和6年第2回臨時会
- `r6-yosannsihinsa.pdf` — 令和6年予算審査特別委員会

### 令和4年以前（西暦下2桁+月）

```
{西暦下2桁}{月2桁}teirei.pdf     # 定例会
{西暦下2桁}{月2桁}rinji.pdf      # 臨時会
{西暦下2桁}{月2桁}yosanshinsa.pdf # 予算審査特別委員会
R{和暦年}kessan.pdf              # 決算審査特別委員会
```

例:
- `0403teirei.pdf` — 令和4年3月定例会
- `0401rinji.pdf` — 令和4年1月臨時会

### 平成年度

```
kaigi-roku_teirei-kai{和暦年}-{回}.pdf    # 定例会
kaigi-roku_rinji-kai{和暦年}-{回}.pdf     # 臨時会
kaigi-roku_yosan_shinsa_tokubetsu_iin-kai{和暦年}.pdf   # 予算審査特別委員会
kaigi-roku_kessan_shinsa_tokubetsu_iin-kai{和暦年}.pdf  # 決算審査特別委員会
```

例:
- `kaigi-roku_teirei-kai18-1.pdf` — 平成18年第1回定例会
- `kaigi-roku_rinji-kai18-3.pdf` — 平成18年第3回臨時会

---

## 会議の種類

| 区分 | 説明 |
| --- | --- |
| 定例会 | 年4回（3月・6月・9月・12月） |
| 臨時会 | 年1〜6回程度（不定期） |
| 予算審査特別委員会 | 年1回（3月頃） |
| 決算審査特別委員会 | 年1回（10月頃） |

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

会議録一覧ページから PDF の URL を抽出する。

**対象ページ:**

1. 最新の会議録一覧: `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/1/1/2213.html`
   - 平成28年〜令和6年の全会議録 PDF リンクがテーブル形式で掲載
2. 年度別一覧: 平成18年〜平成27年は個別のページ（上記ページID参照）
3. 委員会会議概要: `https://www.town.ozora.hokkaido.jp/machinoshirase/chogikai/2/2215.html`

**収集方法:**

1. 各一覧ページの HTML を取得
2. `<a>` タグから `/material/files/group/21/*.pdf` パターンに一致するリンクを Cheerio で抽出
3. テーブル構造から会議区分（定例会/臨時会/特別委員会）と開催日程を併せて取得

### Step 2: PDF のダウンロード

収集した URL から PDF ファイルをダウンロードする。

- ファイルサイズは 170KB〜3.5MB 程度
- 全量で約100件程度の PDF が想定される

### Step 3: PDF からテキストを抽出

PDF から本文テキストを抽出する。

- `pdf-parse` や `pdfjs-dist` 等のライブラリを使用
- PDF のレイアウトは議事録形式（縦書きではなく横書き）

### Step 4: テキストのパース

抽出したテキストからメタ情報と発言内容を構造化する。

#### メタ情報

PDF のテキストから以下を抽出:

- 開催日: テーブルの日付情報（HTML 側）または PDF 冒頭から
- 会議名: テーブルの区分情報（HTML 側）から判定
- 会議種別: 定例会 / 臨時会 / 予算審査特別委員会 / 決算審査特別委員会

#### 発言の構造

PDF の議事録テキストは一般的な議会会議録フォーマットに準拠する想定。具体的なパース規則は PDF の内容を確認した上で決定する。

---

## 注意事項

- PDF のファイル名に表記揺れが多い（`rinnjikai` / `rinjikai`、`yosannsihinsa` / `yosanshinsa` 等）ため、ファイル名からのメタ情報抽出は信頼性が低い。HTML テーブルの情報を優先する
- 平成27年以前の一覧ページは旧サイト構造（`/soshiki/1002/1/5/1/{ID}.html`）へのリンクも存在する
- 委員会の会議概要 PDF は「審議概要」であり、完全な会議録ではない可能性がある
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2秒）を設ける

---

## 推奨アプローチ

1. **HTML 一覧ページを起点にする**: PDF の URL とメタ情報（会議区分・日程）を HTML テーブルから取得し、ファイル名からの推測に頼らない
2. **最新一覧ページ（2213.html）を優先**: 平成28年〜最新までの大部分がこの1ページに集約されている
3. **PDF テキスト抽出の品質検証**: 初回は数件の PDF を手動で確認し、テキスト抽出の品質とパース規則を確定させる
4. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
5. **差分更新**: 一覧ページの更新日（`2025年3月26日` 等）を確認し、新規追加分のみをダウンロードする
