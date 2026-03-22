# 大石田町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/index.html
- 分類: PDF 公開（自治体公式サイト）
- 文字コード: UTF-8

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/index.html` |
| 年度別ページ | `https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/{ページ名}.html` |
| PDF ファイル | `https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/{ページ名}.files/{ファイル名}.pdf` |

---

## ページ階層

```
トップページ > 町政情報 > 町議会 > 会議録
├── 令和6年（gikai20250206.html）
├── 令和5年
├── 令和4年
│   └── ...
└── 平成29年（kaigirokuH30.html）
```

---

## PDF ファイルの命名規則

`R{和暦年}.{月}[.{日}].pdf`

| パターン | 例 | 説明 |
| --- | --- | --- |
| 定例会 | `R6.3.pdf` | 令和6年3月定例会 |
| 定例会 | `R6.6.pdf` | 令和6年6月定例会 |
| 臨時会 | `R6.1.25.pdf` | 令和6年1月25日臨時会 |
| 臨時会 | `R6.11.8.pdf` | 令和6年11月8日臨時会 |

- 定例会: `R{年}.{月}.pdf`（月のみ）
- 臨時会: `R{年}.{月}.{日}.pdf`（月日）

PDF は各年度ページの `.files/` サブディレクトリに格納される。

---

## リンクテキストの形式

```
第{回数}回{定例会/臨時会}（{月}月[{日}日]）会議録
```

例:
- `第1回定例会（3月）会議録`
- `第1回臨時会（1月25日）会議録`

---

## スクレイピング戦略

### Step 1: 年度別ページ URL を収集

トップページ `index.html` から年度別リンクを収集する。

### Step 2: 年度別ページから PDF URL を収集

各年度ページをパースし、`.files/` ディレクトリ内の PDF リンクを全て取得する。

### Step 3: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、テキストを抽出する。

---

## 注意事項

- PDF は年度ページ名に対応する `.files/` サブディレクトリに格納される
- 定例会は月のみ、臨時会は月日で区別される命名規則
- 平成29年〜令和6年の範囲で公開されている
- レート制限: リクエスト間に適切な待機時間（1〜2 秒）を設ける
