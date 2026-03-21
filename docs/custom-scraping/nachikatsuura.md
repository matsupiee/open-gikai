# 那智勝浦町議会 カスタムスクレイピング方針

## 概要

- 自治体コード: 304212
- サイト: https://www.town.nachikatsuura.wakayama.jp/info/1531
- 分類: 独自 CMS による HTML 公開、PDF ダウンロード形式
- 文字コード: UTF-8
- 特記: 単一ページに年度内の全定例会 PDF を掲載。会議は日ごとに分割された PDF で提供

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧ページ | `https://www.town.nachikatsuura.wakayama.jp/info/1531` |
| PDF ファイル | `https://www.town.nachikatsuura.wakayama.jp/div/gikai/pdf/kaigiroku/kaigirokuR{yy}-{mm}-{n}.pdf` |

---

## PDF ファイル命名規則

```
kaigirokuR{yy}-{mm}-{n}.pdf
```

| 要素 | 値 | 意味 |
| --- | --- | --- |
| `R{yy}` | `R06` | 令和年号 2 桁（例: 令和 6 年 = `R06`） |
| `{mm}` | `03` / `06` / `09` / `12` | 定例会開催月（2 桁） |
| `{n}` | `1` 〜 `7` | 会議日（第 N 日、1 桁） |

例:
- `kaigirokuR06-03-1.pdf` → 令和 6 年第 1 回（3 月）定例会 第 1 日
- `kaigirokuR06-09-7.pdf` → 令和 6 年第 3 回（9 月）定例会 第 7 日

---

## 会議構造（令和 6 年の例）

| 定例会 | 開催月 | 日数 | PDF ファイル |
| --- | --- | --- | --- |
| 第 1 回定例会 | 3 月 | 7 日 | `kaigirokuR06-03-1.pdf` 〜 `kaigirokuR06-03-7.pdf` |
| 第 2 回定例会 | 6 月 | 5 日 | `kaigirokuR06-06-1.pdf` 〜 `kaigirokuR06-06-5.pdf` |
| 第 3 回定例会 | 9 月 | 7 日 | `kaigirokuR06-09-1.pdf` 〜 `kaigirokuR06-09-7.pdf` |
| 第 4 回定例会 | 12 月 | 3 日 | `kaigirokuR06-12-1.pdf` 〜 `kaigirokuR06-12-3.pdf` |

定例会は年 4 回（3 月・6 月・9 月・12 月）開催。各定例会の日数は 1〜7 日で変動する。

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF リンクを収集

`https://www.town.nachikatsuura.wakayama.jp/info/1531` を取得し、PDF リンクを全て抽出する。

- リンク形式: `<a href="/div/gikai/pdf/kaigiroku/kaigirokuR{yy}-{mm}-{n}.pdf">`
- 掲載される年度は原則として現在年度のみ

### Step 2: 過去年度の PDF を推定取得（オプション）

命名規則が規則的なため、過去年度の PDF URL を生成して存在確認できる。

```
https://www.town.nachikatsuura.wakayama.jp/div/gikai/pdf/kaigiroku/kaigirokuR{yy}-{mm}-{n}.pdf
```

- `{yy}`: `01`（令和元年）〜 現在
- `{mm}`: `03`、`06`、`09`、`12`
- `{n}`: `1` から連番で増やし、404 が返ったら次の月へ

### Step 3: PDF のダウンロード

収集した URL からダウンロードする。

---

## 注意事項

- 一覧ページに掲載されるのは当年度分のみ。過去年度は URL を推定して取得する必要がある
- 各定例会の会議日数が年度・回ごとに異なるため、日数を固定せず 404 チェックで対応する
- 年号は令和元年が `R01`（または `R1`）である可能性があるため、実際のリンクで確認が必要
- レート制限: リクエスト間に 1〜2 秒の待機時間を設ける

---

## 推奨アプローチ

1. `info/1531` ページの PDF リンクを Cheerio で抽出（`a[href$=".pdf"]`）して現在年度分を取得
2. 過去年度分は URL パターンから生成し、HTTP 200 が返るものだけを収集
3. 月（3・6・9・12）と日（1 〜 N）の組み合わせでクロールし、404 で打ち止め
4. 全 PDF をダウンロードして処理
