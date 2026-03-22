# 大蔵村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.ohkura.yamagata.jp/gyoseijoho/okurasongikai/2301.html
- 分類: PDF 公開（自治体公式サイト）
- 文字コード: UTF-8

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧 | `https://www.vill.ohkura.yamagata.jp/gyoseijoho/okurasongikai/2301.html` |
| PDF ファイル | `https://www.vill.ohkura.yamagata.jp/material/files/group/9/{ファイル名}.pdf` |

---

## ページ階層

```
ホーム > 行政情報 > 大蔵村議会 > 大蔵村議会会議録
├── 令和7年 会議録
│   ├── 定例会3月（R7teirei3gatsu.pdf）
│   └── ...
├── 令和6年 会議録
│   ├── 定例会（R6teirei{月}gatsu.pdf）
│   └── 臨時会（R6rinji{月}gatsu.pdf）
├── 令和5年 会議録
└── 令和4年 会議録
```

1ページに全年度の会議録 PDF リンクが掲載される単純な構造。

---

## PDF ファイルの命名規則

`R{和暦年}{種別}{月}gatsu.pdf`

| パターン | 例 | 説明 |
| --- | --- | --- |
| 定例会 | `R7teirei3gatsu.pdf` | 令和7年 定例会 3月 |
| 定例会 | `R6teirei12gatsu.pdf` | 令和6年 定例会 12月 |
| 臨時会 | `R6rinji5gatsu.pdf` | 令和6年 臨時会 5月 |

命名要素:
- `R{年}`: 和暦年号
- `teirei`: 定例会 / `rinji`: 臨時会
- `{月}gatsu`: 月（日本語ローマ字）

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF URL を収集

対象ページ `2301.html` をパースし、`material/files/group/9/` 配下の PDF リンクを全て取得する。

- 各 PDF は `<a>` タグで直接リンクされている
- ファイルサイズが括弧内に表示される

### Step 2: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、テキストを抽出する。

---

## 注意事項

- 1ページ完結型のため、ページ遷移は不要（最もシンプルな構造）
- PDF は `material/files/group/9/` ディレクトリに集約されている
- ファイル命名規則が一貫しており、パターンマッチが容易
- レート制限: リクエスト間に適切な待機時間（1〜2 秒）を設ける
