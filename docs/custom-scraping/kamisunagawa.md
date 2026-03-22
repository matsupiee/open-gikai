# 上砂川町議会 カスタムスクレイピング方針

## 概要

- サイト: https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/index.html
- 分類: 自治体公式サイト内の静的 HTML + PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: SMART CMS 採用、会議録本文は PDF ファイルで提供

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会結果・会議録トップ | `https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/index.html` |
| 定例会 年度別一覧 | `https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/teirei/{年度コード}/index.html` |
| 臨時会 年度別一覧 | `https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/rinji/{年度コード}/index.html` |
| 各回の結果ページ | `https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/{teirei\|rinji}/{年度コード}/{ページID}.html` |
| 会議録 PDF | `https://town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_{年度コード}_{種別}{回数}.pdf` |

### 年度コード

| 元号 | プレフィックス | 例 |
| --- | --- | --- |
| 令和 | `r` | `r6`（令和6年）、`r7`（令和7年） |
| 平成 | `h` | `h30`（平成30年）、`h31`（平成31年/令和元年） |

対象範囲: 平成19年（h19）〜 現在

### 会議録 PDF ファイル名パターン

| 会議種別 | ファイル名パターン | 例 |
| --- | --- | --- |
| 定例会 | `kaigiroku_{年度コード}_t{回数}.pdf` | `kaigiroku_r6_t1.pdf`（令和6年第1回定例会） |
| 臨時会 | `kaigiroku_{年度コード}_r{回数}.pdf` | `kaigiroku_r7_r5.pdf`（令和7年第5回臨時会） |

---

## サイト構造

### 3 階層構造

```
トップページ (index.html)
  └── 年度別一覧 (teirei/r7/index.html, rinji/r7/index.html)
        └── 各回の結果ページ ({ページID}.html)
              └── 会議録 PDF (kaigiroku_*.pdf)
```

### トップページ

- 定例会・臨時会それぞれについて、年度ごとのリンクを一覧表示
- ページネーションなし（全年度が 1 ページに列挙）

### 年度別一覧ページ

- 該当年度の各回（第1回〜第4回等）へのリンクを箇条書きで表示
- 各リンクに開催日程（例: `3月7日〜3月18日`）が併記
- リンク先は `{ページID}.html` 形式（例: `2222.html`）

### 各回の結果ページ

- **議案テーブル**: 議件番号・議件名・議決年月日・結果の 4 列構成
- **会議録 PDF リンク**: ページ内に 1 つの PDF リンクが掲載
- PDF リンクのラベル: `会議録（令和X年第Y回定例会 M月D日〜M月D日）(PDFファイル: XXX.XKB)`

---

## スクレイピング戦略

### Step 1: 年度別一覧ページの URL 生成

トップページから年度リンクを収集するか、年度コードのパターンから URL を生成する。

**生成方法:**

1. 定例会: `teirei/{h19..h31, r2..r8}/index.html`
2. 臨時会: `rinji/{h19..h31, r2..r8}/index.html`

### Step 2: 各回の結果ページ URL の収集

年度別一覧ページから各回へのリンク（`{ページID}.html`）を抽出する。

- リンクは `<a>` タグで提供される
- ページ ID は数値（例: `2222`, `1973`）

### Step 3: 会議録 PDF URL の収集

各回の結果ページから PDF リンクを抽出する。

- PDF リンクは `//town.kamisunagawa.hokkaido.jp/material/files/group/8/kaigiroku_*.pdf` 形式
- プロトコル省略形式（`//` 始まり）のため、`https:` を付与して使用する

### Step 4: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）でテキストを抽出
- 会議録の構造（発言者・発言内容）は PDF 内のテキストレイアウトに依存

---

## 注意事項

- 会議録は HTML 本文ではなく **PDF ファイルのみ** で提供されている
- PDF ファイル名のパターンは推測可能だが、各回の結果ページから確実にリンクを取得する方が安全
- SMART CMS を使用しており、一部コンテンツが JavaScript（`$.getJSON()`）で動的に読み込まれる可能性がある
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
- 平成31年/令和元年は `h31` で管理されている

---

## 推奨アプローチ

1. **3 階層を順にクロール**: トップ → 年度別一覧 → 各回結果ページの順で PDF URL を収集
2. **PDF テキスト抽出**: HTML 本文がないため、PDF パーサーによるテキスト抽出が必須
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 年度コード + 回数の組み合わせで既取得分を判定し、新規分のみ取得する
