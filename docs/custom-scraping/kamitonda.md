# 上富田町議会 カスタムスクレイピング方針

## 概要

- 自治体コード: 304042
- サイト: http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/index.html
- 分類: 独自 CMS による HTML 公開、PDF ダウンロード形式
- 文字コード: UTF-8
- 特記: 年度インデックスページ → 年度別詳細ページ → PDF の 2 段階構成

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録インデックス | `http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/index.html` |
| 年度別詳細ページ | `http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/{ID}.html` |
| PDF ファイル | `http://www.town.kamitonda.lg.jp/material/files/group/8/{ファイル名}.pdf` |

ID は数値（例: `4199`、`4542`、`4042` など）で年度ごとに異なる。

---

## 年度インデックス

インデックスページには平成 19 年から令和 7 年までの年度別リンクが一覧表示される（ページネーションなし）。

リンクテキスト例:
- `上富田町議会 令和6年 会議録`
- `上富田町議会 令和5年 会議録`
- `上富田町議会 平成31年(令和元年) 会議録`

---

## 年度別詳細ページの構成

各年度詳細ページには定例会・臨時会ごとに PDF が掲載される。

令和 6 年（`/soshiki/gikai/kaigiroku/4199.html`）の例:

| 会議 | 日程 | PDF ファイル名 |
| --- | --- | --- |
| 第 4 回（12 月）定例会 目次 | - | `202412Tmokuji.pdf` |
| 第 4 回（12 月）定例会 第 1 日目 | 12 月 6 日 | `20241206Tgijiroku.pdf` |
| 第 4 回（12 月）定例会 第 2 日目 | 12 月 16 日 | `20241216Tgijiroku.pdf` |
| 第 4 回（12 月）定例会 第 3 日目 | 12 月 18 日 | `20241218Tgijiroku.pdf` |
| 第 3 回（9 月）定例会 目次 | - | `202409Tmokuji.pdf` |
| 第 3 回（9 月）定例会 第 1 日目 | 9 月 5 日 | `20240905Tgijiroku.pdf` |
| 第 3 回（9 月）定例会 第 2 日目 | 9 月 13 日 | `20240913Tgijiroku.pdf` |
| 第 3 回（9 月）定例会 第 3 日目 | 9 月 18 日 | `20240918Tgijiroku.pdf` |
| 第 2 回（6 月）定例会 目次 | - | `202406Tmokuji.pdf` |
| 第 2 回（6 月）定例会 第 1 日目 | 6 月 13 日 | `20240613Tgijiroku.pdf` |
| 第 2 回（6 月）定例会 第 2 日目 | 6 月 20 日 | `20240620Tgijiroku.pdf` |
| 第 2 回（6 月）定例会 第 3 日目 | 6 月 24 日 | `20240624Tgijiroku.pdf` |
| 第 2 回（5 月）臨時会 目次 | - | `202405Rmokuji.pdf` |
| 第 2 回（5 月）臨時会 第 1 日目 | 5 月 17 日 | `202405Rgijiroku.pdf` |
| 第 1 回（3 月）定例会 目次 | - | `202403Tmokuji.pdf` |
| 第 1 回（3 月）定例会 第 1 日目 | 2 月 29 日 | `20240229Tgijiroku.pdf` |
| 第 1 回（3 月）定例会 第 2 日目 | 3 月 6 日 | `20240306Tgijiroku.pdf` |
| 第 1 回（3 月）定例会 第 3 日目 | 3 月 19 日 | `20240319Tgijiroku.pdf` |
| 第 1 回（1 月）臨時会 目次 | - | `202401Rmokuji.pdf` |
| 第 1 回（1 月）臨時会 第 1 日目 | 1 月 29 日 | `20240129Rgijiroku.pdf` |

---

## PDF ファイル命名規則

```
{yyyymm}{会議種別}{suffix}.pdf
```

| 要素 | 値 | 意味 |
| --- | --- | --- |
| `{yyyymm}` | `202412` | 年月（6 桁） |
| 会議種別 | `T` | 定例会（Teireikai） |
| 会議種別 | `R` | 臨時会（Rinji-kai） |
| suffix | `mokuji` | 目次 |
| suffix | `gijiroku` | 議事録本文 |

個別会議録は日付付き: `{yyyymmdd}{T/R}gijiroku.pdf`

---

## スクレイピング戦略

### Step 1: 年度インデックスの取得

`/soshiki/gikai/kaigiroku/index.html` を取得し、各年度の詳細ページ URL を抽出する。

- リンク形式: `<a href="/soshiki/gikai/kaigiroku/{ID}.html">`
- 平成 19 年から現在まで（ページネーションなし）

### Step 2: 各年度詳細ページから PDF リンクを収集

各年度詳細ページを取得し、PDF へのリンク（`href` が `.pdf` で終わるもの）を全て抽出する。

- PDF URL 形式: `//www.town.kamitonda.lg.jp/material/files/group/8/{ファイル名}.pdf`（プロトコル相対 URL）
- 目次 PDF と本文 PDF が別ファイルで提供される
- リンクテキストから会議種別・日程を取得

### Step 3: PDF のダウンロード

収集した URL（`http://` を補完）からダウンロードする。

---

## 注意事項

- PDF URL がプロトコル相対（`//www.town.kamitonda...`）のため、スキーム（`http:`）を補完する必要がある
- サイトが HTTP（非 HTTPS）のため、HTTPS リダイレクトに注意
- 目次 PDF は議事録本文を含まないため、取得対象から除外するか区別して管理する
- レート制限: リクエスト間に 1〜2 秒の待機時間を設ける

---

## 推奨アプローチ

1. インデックスページから年度別詳細ページの URL を全量取得
2. 各年度ページの PDF リンクを Cheerio で抽出（`a[href$=".pdf"]`）
3. 目次ファイル（`mokuji` を含む）と本文ファイル（`gijiroku` を含む）を区別して管理
4. 全本文 PDF をダウンロードして処理
