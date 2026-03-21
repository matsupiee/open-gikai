# 白石町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku.html
- 分類: 商用 CMS（PowerCMS 系と推定、`_[番号].html` 形式の個別ページ + PDF リンク）
- 文字コード: UTF-8
- 特記: `pbGlobalAliasBase` 変数あり、Google Translate 対応

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku.html` |
| 年度別一覧（令和7年） | `https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy.html` |
| 会議別詳細ページ | `https://www.town.shiroishi.lg.jp/chousei_machi/gikai/kaigiroku/[年度ページ名]/_[番号].html` |
| PDF ファイル | `https://www.town.shiroishi.lg.jp/var/rev0/0002/[番号]/kaigiroku.pdf` |

---

## 年度別ページ一覧

| 年度 | URL パス |
| --- | --- |
| 平成29年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy.html` |
| 平成30年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy.html` |
| 平成31年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_2.html` |
| 令和元年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy.html` |
| 令和2年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy.html` |
| 令和3年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy.html` |
| 令和4年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy.html` |
| 令和5年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy.html` |
| 令和6年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2.html` |
| 令和7年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy.html` |
| 令和8年 | `/chousei_machi/gikai/kaigiroku/h27_copy_copy_copy_copy_copy_copy_copy_copy_copy_2_copy_copy.html` |

URL はページをコピーして作成した痕跡が残る名称（`h27` ベースに `_copy` が連結）となっており、規則的なパターンがない。**必ずトップページから全リンクを取得する必要がある。**

---

## 会議録の提供形式

各会議の詳細ページ（`_[番号].html`）に日別の PDF リンクが掲載される形式。

**平成29年3月定例会（_2807.html）の例（8件）:**

| 開催日 | URL |
| --- | --- |
| 3月6日 | `https://www.town.shiroishi.lg.jp/var/rev0/0002/7885/kaigiroku.pdf` |
| 3月7日 | `https://www.town.shiroishi.lg.jp/var/rev0/0002/7886/kaigiroku.pdf` |
| 3月8日 | `https://www.town.shiroishi.lg.jp/var/rev0/0002/7887/kaigiroku.pdf` |
| ... | ... |
| 3月17日 | `https://www.town.shiroishi.lg.jp/var/rev0/0002/7892/kaigiroku.pdf` |

**PDF URL 形式:**
```
https://www.town.shiroishi.lg.jp/var/rev0/0002/[番号]/kaigiroku.pdf
```

- グループ ID は `0002` で固定
- ファイル番号は連番（例: 7885〜7892）
- PDF ファイル名は常に `kaigiroku.pdf`（固定）

---

## 会議種別

**令和7年の構成（5件）:**

| 開催月 | 会議種別 | 詳細ページ ID |
| --- | --- | --- |
| 2月 | 臨時会 | _7931 |
| 3月 | 定例会 | _7932 |
| 6月 | 定例会 | _7933 |
| 9月 | 定例会 | _7935 |
| 12月 | 定例会 | _7936 |

**平成29年の構成（6件）:**

| 開催月 | 会議種別 | 詳細ページ ID |
| --- | --- | --- |
| 2月 | 臨時議会 | _2806 |
| 3月 | 定例会 | _2807 |
| 6月 | 定例会 | _2810 |
| 9月 | 定例会 | _2864 |
| 11月 | 臨時会 | _2911 |
| 12月 | 定例会 | _2912 |

定例会は年4回（3月・6月・9月・12月）、臨時会は年1〜2回程度。

---

## ページネーション

なし。各年度ページに当年の全会議がリスト表示される（年5〜6件程度）。

---

## スクレイピング戦略

### Step 1: 年度ページ URL の収集

トップページ（`/chousei_machi/gikai/kaigiroku.html`）から全年度ページへのリンクを抽出する。

- URL に規則性がないため（`h27_copy_copy...` 形式）、必ずトップページのリンクを動的に取得する
- 掲載範囲: 平成29年（2017年）〜現在

### Step 2: 年度別ページから会議別詳細ページ URL を収集

各年度ページから `_[番号].html` 形式のリンクを抽出する。

- リンク形式: `./[年度ページ名]/_[番号].html`（相対パス）
- 1年度あたり4〜6件程度

### Step 3: 会議別詳細ページから PDF リンクを収集

各会議詳細ページから `/var/rev0/0002/[番号]/kaigiroku.pdf` 形式のリンクを抽出する。

- 1会議あたり日別に複数 PDF（3〜10件程度）
- PDF ファイル名は全て `kaigiroku.pdf` で統一されているため、ページ番号で識別する

### Step 4: PDF のダウンロードと解析

- 会議詳細ページの本文から開催日・会議種別を取得
- 定例会の場合は複数日にわたる会議録が日別に分割されている

---

## 注意事項

- 年度ページの URL は `h27` から `_copy` が積み重なる非規則的な命名で管理されており、URL 予測が不可能
- 平成29年（2017年）から掲載あり（それ以前の記録は未掲載）
- PDF ファイル名が全て `kaigiroku.pdf` で統一されているため、URL のディレクトリ番号で個別識別する
