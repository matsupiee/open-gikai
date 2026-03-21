# 砥部町議会（愛媛県）カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/3677.html
- 分類: PDF 形式での公開（年度別ページに会議録 PDF リンクを直接掲載）
- 文字コード: UTF-8
- 対象期間: 平成17年（2005年）〜令和8年（2026年）
- 特記: 専用の会議録検索システムは未導入。公式ホームページ上で定例会・臨時会ごとに会議録 PDF および会議結果 PDF を直接ダウンロード提供。各年度ページに PDF が直接リンクされており、詳細ページを介さない 2 段階構造。PDF は `//www.town.tobe.ehime.jp/material/files/group/17/` 配下に格納。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年度一覧（トップ） | `https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/index.html` |
| 年度別会議録一覧 | `https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/{ID}.html` |
| PDF ファイル | `https://www.town.tobe.ehime.jp/material/files/group/17/{ID}.pdf` |

- 検索ページ: なし
- 詳細ページ: なし（年度別一覧ページに PDF リンクが直接掲載される）
- ページネーション: なし（各ページで全件を一覧表示）

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和8（2026）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html` |
| 令和7（2025）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/4550.html` |
| 令和6（2024）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/3677.html` |
| 令和5（2023）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/455.html` |
| 令和4（2022）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/609.html` |
| 令和3（2021）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1018.html` |
| 令和2（2020）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1039.html` |
| 平成31年/令和元（2019）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1079.html` |
| 平成30（2018）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1128.html` |
| 平成29（2017）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1114.html` |
| 平成28（2016）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1166.html` |
| 平成27（2015）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1167.html` |
| 平成26（2014）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1165.html` |
| 平成25（2013）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1191.html` |
| 平成24（2012）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1190.html` |
| 平成23（2011）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1189.html` |
| 平成22（2010）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1188.html` |
| 平成21（2009）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1276.html` |
| 平成20（2008）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1272.html` |
| 平成19（2007）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1275.html` |
| 平成18（2006）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1274.html` |
| 平成17（2005）年 | `/soshikikarasagasu/gikaijimukyoku/teireikai/1273.html` |

年度別ページの ID は非連番のため、トップページから動的に取得すること。

---

## HTML 構造

### 年度一覧ページ（index.html）

```html
<a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/5259.html">令和8年定例会・臨時会</a>
<a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/4550.html">令和7年定例会・臨時会</a>
<a href="https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/3677.html">令和6年定例会・臨時会</a>
...
```

- 各年度へのリンクが `<a>` 形式で列挙されている
- リンクテキストは「令和X年定例会・臨時会」または「平成X年定例会・臨時会」形式

### 年度別会議録一覧ページ（{ID}.html）

```html
<h1 class="title"><span class="bg"><span class="bg2">令和6年定例会・臨時会</span></span></h1>

<h2><span class="bg"><span class="bg2"><span class="bg3">第4回定例会（12月5日から12月13日まで）</span></span></span></h2>
<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/117.pdf">第4回定例会会議結果 (PDFファイル: 140.5KB)</a></p>

<h2><span class="bg"><span class="bg2"><span class="bg3">第3回定例会（9月5日から9月13日まで）</span></span></span></h2>
<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/105.pdf">第3回定例会会議録 (PDFファイル: 1.1MB)</a></p>
<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/107.pdf">第3回定例会会議結果 (PDFファイル: 135.4KB)</a></p>

<h2><span class="bg"><span class="bg2"><span class="bg3">第3回臨時会（6月27日）</span></span></span></h2>
<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/90.pdf">第3回臨時会会議録 (PDFファイル: 267.4KB)</a></p>
<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/91.pdf">第3回臨時会会議結果 (PDFファイル: 73.0KB)</a></p>
```

- `<h1>` で年度見出し（例: 「令和6年定例会・臨時会」）
- `<h2>` で会議単位の見出し（例: 「第4回定例会（12月5日から12月13日まで）」「第3回臨時会（6月27日）」）
- PDF リンクは `<p class="file-link-item"><a class="pdf" href="//www.town.tobe.ehime.jp/material/files/group/17/{ID}.pdf">` 形式
- 1 回の会議につき「会議録」と「会議結果」の 2 種類の PDF が掲載される
- PDF の href は `//` から始まるプロトコル相対 URL のため、`https:` を補完して絶対 URL にする必要がある

---

## 会議種別と開催パターン

| 種別 | 開催回数（目安） |
| --- | --- |
| 定例会 | 年4回（第1〜4回、概ね 2月・6月・9月・12月） |
| 臨時会 | 随時（年1〜3回程度） |

- 会議ごとに PDF は 1 セット（会議録 + 会議結果）が基本
- 委員会会議録の公開は確認されていない
- 開催期間の表記: 複数日の場合は「X月X日からX月X日まで」、1 日の場合は「X月X日」

---

## PDF ファイルの特徴

- URL パターン: `https://www.town.tobe.ehime.jp/material/files/group/17/{ID}.pdf`
- ID は数値だが、年度・会議との対応は不規則（例: 116, 117, 3864, 27581 等が混在）
- リンクテキストに「(PDFファイル: XXX.XKB)」の形式でファイルサイズが記載される
- 2 種類の PDF が存在:
  - **会議録**: 会議の発言・議事内容を詳細に記録したもの（大容量: 数百KB〜数MB）
  - **会議結果**: 議決結果のみを簡潔にまとめたもの（小容量: 数十KB〜数百KB）
- スクレイピング対象は主に「会議録」PDF（会議結果は補助的な参照に留める）

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/index.html` から年度別ページへのリンクを抽出する。

- `a[href*="/teireikai/"]` セレクタで全年度ページへのリンクを抽出
- `index.html` を含むリンクは除外（トップページ自身へのリンク）
- 年度ページの ID は非連番のため、必ずトップページから動的に取得する

### Step 2: PDF リンクの収集

各年度別ページ `{ID}.html` から PDF リンクを直接抽出する。

- `p.file-link-item a.pdf` セレクタで PDF リンクを抽出
- 会議種別の判定: 直前の `<h2>` タグのテキストから「定例会」「臨時会」を判定する
- 「会議録」と「会議結果」の区別: リンクテキストに「会議録」または「会議結果」を含む
- PDF URL の正規化: `//www.town.tobe.ehime.jp/...` → `https://www.town.tobe.ehime.jp/...` に変換する

#### h2 テキストのパース例

```typescript
// "第4回定例会（12月5日から12月13日まで）" → { session: 4, type: "定例会", period: "12月5日から12月13日まで" }
// "第3回臨時会（6月27日）" → { session: 3, type: "臨時会", period: "6月27日" }
const h2Pattern = /第(\d+)回(定例会|臨時会)（(.+?)）/;
```

### Step 3: PDF のダウンロード

収集した会議録 PDF URL から PDF をダウンロードする。

- 総 PDF 数は会議録のみで約 170〜200 件（22 年分 × 年 5〜7 件程度）
- 「会議結果」PDF はオプション扱いとし、「会議録」PDF を優先取得する
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

### Step 4: PDF からのテキスト抽出・パース

PDF からテキストを抽出し、構造化データに変換する。

- PDF パーサー（pdf-parse 等）でテキストを抽出
- 1 つの PDF に 1 回の会議の全発言が含まれる

#### メタ情報の抽出

年度別ページの HTML から以下を取得:

```
令和6年定例会・臨時会
  第4回定例会（12月5日から12月13日まで）
    会議録 → //www.town.tobe.ehime.jp/material/files/group/17/116.pdf
    会議結果 → //www.town.tobe.ehime.jp/material/files/group/17/117.pdf
  第3回臨時会（6月27日）
    会議録 → //www.town.tobe.ehime.jp/material/files/group/17/90.pdf
    会議結果 → //www.town.tobe.ehime.jp/material/files/group/17/91.pdf
```

- 開催年度: `<h1>` の「令和X年定例会・臨時会」または「平成X年定例会・臨時会」から抽出
- 会議回次・種別・開催期間: `<h2>` テキスト（「第X回定例会（X月X日から...）」等）から抽出
- ファイル種別: リンクテキスト中の「会議録」「会議結果」で判定

#### 発言の構造（PDF 内テキスト）

PDF 内のテキスト構造は実際のファイルをダウンロードして確認する必要がある。一般的な議会会議録 PDF では以下のパターンが想定される:

```
○議長（氏名）
  発言内容...

○X番（氏名）
  発言内容...

○町長（氏名）
  発言内容...
```

※ 実際のフォーマットは PDF ダウンロード後に確認・調整が必要

---

## 注意事項

- **プロトコル相対 URL**: PDF の href が `//www.town.tobe.ehime.jp/...` 形式（プロトコル相対）のため、絶対 URL に変換する際は `https:` を先頭に付与する。
- **年度別ページ URL の非連番**: `{ID}` 部分は非連番（例: 455, 609, 1018, 1039 が令和2〜5年に対応）なため、URL を固定値でハードコードせずトップページから動的に取得するか、本ドキュメントの一覧表を初期シードとして使用する。
- **平成31年 / 令和元年の扱い**: 平成31年ページ（`1079.html`）のタイトルは「平成31年(令和元年)定例会・臨時会」。年度情報をパースする際は「平成31年」も令和元年度として処理すること。
- **2 種類の PDF**: 「会議録」と「会議結果」が同一 `<h2>` セクション下に並列掲載される。会議録（発言内容）のみを抽出対象とし、会議結果（議決サマリー）は除外するか別扱いにする。
- **PDF 品質の確認**: テキスト PDF かスキャン PDF かを事前に数件ダウンロードして確認すること。スキャン PDF の場合は OCR が必要になる。

---

## 推奨アプローチ

1. **2 段階のクロール**: トップページ → 年度別一覧ページ → PDF という 2 段階の階層構造をたどる（詳細ページは存在しない）
2. **動的な URL 収集**: 年度ページの ID は非連番のため、トップページから `a[href*="/teireikai/"]` で動的に取得する
3. **h2 タグによる会議単位の判定**: `<h2>` テキストを手がかりに会議回次・種別・開催期間を判定し、各 PDF にメタ情報を付与する
4. **会議録のみ優先取得**: 同一会議に「会議録」と「会議結果」の 2 PDF が存在するため、リンクテキストで「会議録」を含むものを優先する
5. **PDF テキスト品質の事前確認**: 数件の PDF をダウンロードしてテキスト抽出の品質を確認し、スキャン PDF かテキスト PDF かを判定する
6. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
