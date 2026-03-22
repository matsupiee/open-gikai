# 長井市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/index.html
- 分類: PDF 公開（自治体公式サイト）
- 文字コード: UTF-8

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/index.html` |
| 年度別一覧 | `https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/{ページID}.html` |
| 年度別詳細 | `https://www.city.nagai.yamagata.jp/soshiki/gikai/106/203/1/kaigiroku/{年度コード}/{ページID}.html` |
| PDF ファイル | `https://www.city.nagai.yamagata.jp/material/files/group/19/{ファイル名}.pdf` |

---

## ページ階層

```
会議録トップ（index.html）
├── 令和7年（15203.html）
│   ├── 1月臨時会、3月定例会会議録（15057.html）
│   ├── 5月臨時会、6月定例会会議録（15058.html）
│   ├── 9月定例会会議録（15059.html）
│   └── 12月定例会、12月臨時会会議録（15060.html）
├── 令和6年
│   └── ...
└── 平成16年
```

---

## PDF ファイルの命名規則

`nagaigikai_{和暦年号}_{月2桁}_{日2桁}[_{種別}].pdf`

| パターン | 例 | 説明 |
| --- | --- | --- |
| 通常会議 | `nagaigikai_R7_01_24.pdf` | 令和7年1月24日 |
| 開議 | `nagaigikai_R7_03_04_kaigi.pdf` | 3月4日開議 |
| 予算委員会 | `nagaigikai_yosan_R7_03_13_kaigi.pdf` | 予算委員会 3月13日 |

---

## スクレイピング戦略

### Step 1: 年度別ページ URL を収集

トップページ `index.html` から年度別リンクを収集する。年度は令和7年〜平成16年まで。

### Step 2: 年度別ページから会期別ページ URL を収集

各年度ページ内のリンクから、会期別の詳細ページ URL を取得する。

### Step 3: 会期別ページから PDF URL を収集

各詳細ページをパースし、`material/files/group/19/` 配下の PDF リンクを全て取得する。

### Step 4: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、テキストを抽出する。

---

## 注意事項

- 3階層構造（トップ → 年度 → 会期別）のため、2段階のリンク収集が必要
- PDF は `material/files/group/19/` ディレクトリに集約されている
- 臨時会と定例会がまとめて1ページに掲載される場合がある
- レート制限: リクエスト間に適切な待機時間（1〜2 秒）を設ける
