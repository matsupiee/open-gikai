# 朝日町（教育委員会）カスタムスクレイピング方針

## 概要

- サイト: https://www.town.asahi.yamagata.jp/portal/soshikinogoannai/kyoikubunkaka/gakkokyoikukakari/1_1/1/9645.html
- 分類: PDF 公開（自治体公式サイト・教育委員会定例会）
- 文字コード: UTF-8

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧 | `https://www.town.asahi.yamagata.jp/portal/soshikinogoannai/kyoikubunkaka/gakkokyoikukakari/1_1/1/9645.html` |
| PDF ファイル | `https://www.town.asahi.yamagata.jp/material/files/group/11/{ファイル名}.pdf` |

---

## ページ階層

```
ホーム > くらしの情報 > 組織のご案内 > 教育文化課
> 学校教育係 > 教育委員会 > 定例会 > 令和6年度定例会会議録
```

1ページに年度内の全会議録 PDF リンクが掲載される単純な構造。

---

## PDF ファイルの命名規則

`R{和暦年}_{月}.pdf`

| パターン | 例 | 説明 |
| --- | --- | --- |
| 通常 | `R6_4.pdf` | 令和6年4月定例会 |
| 修正版 | `R6_7shusei.pdf` | 令和6年7月定例会（修正版） |
| 臨時会 | 別途命名 | 臨時会は個別の命名 |

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF URL を収集

対象ページ `9645.html` をパースし、`material/files/group/11/` 配下の PDF リンクを全て取得する。

- 各 PDF は `<a>` タグで直接リンクされている
- ファイルサイズが括弧内に表示される（例: `258.1KB`）

### Step 2: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、テキストを抽出する。

---

## 注意事項

- 教育委員会の定例会会議録であり、議会の会議録ではない点に注意
- 1ページ完結型のため、ページ遷移は不要
- 修正版（`shusei` サフィックス）が存在する場合は修正版を優先取得する
- 年度が変わると別ページになる可能性がある
- レート制限: リクエスト間に適切な待機時間（1〜2 秒）を設ける
