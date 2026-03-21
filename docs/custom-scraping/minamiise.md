# 南伊勢町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/index.html
- 分類: 独自 CMS による PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: **本会議の会議録（議事録本文）はオンライン未公開**。議会事務局ページには審議結果・一般質問事項・会期日程・テレビ放送スケジュールの PDF のみが掲載されており、統一された会議録検索システムは存在しない。

---

## サイト構造

議会事務局トップ (`/admin/shoshiki/gikaijimu/index.html`) から以下のセクションへリンクがある。

| セクション | URL パターン | 公開コンテンツ |
| --- | --- | --- |
| 定例会・臨時会情報 | `/admin/shoshiki/gikaijimu/teireirinji/index.html` | 会期日程・テレビ放送スケジュール PDF |
| 南伊勢町議会審議結果 | `/admin/shoshiki/gikaijimu/shingikekka/index.html` | 議決結果 PDF |
| 一般質問事項一覧 | `/admin/shoshiki/gikaijimu/ippan/index.html` | 一般質問通告書 PDF |
| 委員会について | `/admin/shoshiki/gikaijimu/iinkai/index.html` | 委員会活動報告・写真 PDF |
| 議会の動き | `/admin/shoshiki/gikaijimu/gikainougoki/index.html` | 月別活動報告（テキスト・写真のみ） |
| 議会広報誌 | `/admin/shoshiki/gikaijimu/kouhoushi/index.html` | 広報誌 PDF |

---

## 会議録の公開状況

### 公開されていないもの

- **本会議の会議録（議事録本文）**: いずれのセクションにも PDF・HTML 形式での公開は確認できない。

### 公開されているもの（代替情報）

#### 1. 審議結果（議決結果）PDF

各定例会・臨時会の議決案件一覧を PDF で公開。

| ページ種別 | URL パターン |
| --- | --- |
| 審議結果 年度インデックス | `https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/shingikekka/index.html` |
| 年度別一覧（令和3年〜） | `/admin/shoshiki/gikaijimu/shingikekka/{数値ID}.html` |
| 年度別一覧（〜平成30年） | `/admin/shoshiki/gikaijimu/shingikekka/h{年号2桁}/index.html` |
| 各会議の審議結果ページ | `/admin/shoshiki/gikaijimu/shingikekka/h{年号2桁}/{数値ID}.html` |
| PDF ファイル | `https://www.town.minamiise.lg.jp/material/files/group/16/{ファイル名}.pdf` |

**年度別インデックス URL の例:**

| 年度 | URL |
| --- | --- |
| 令和8年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 令和7年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 令和6年 | `/admin/shoshiki/gikaijimu/shingikekka/6475.html` |
| 令和5年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 令和4年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 令和3年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 令和2年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 令和元年 | `/admin/shoshiki/gikaijimu/shingikekka/{未確認}.html` |
| 平成30年 | `/admin/shoshiki/gikaijimu/shingikekka/1689.html` |
| 平成29年 | `/admin/shoshiki/gikaijimu/shingikekka/h29/index.html` |
| 平成28年 | `/admin/shoshiki/gikaijimu/shingikekka/h28/index.html` |
| 平成27年 | `/admin/shoshiki/gikaijimu/shingikekka/h27/index.html` |
| 平成17〜26年 | 同様に `/h{年号2桁}/index.html` |

※ 年度別インデックスの数値 ID は CMS 割り当てのため予測不可。審議結果インデックスページから動的に取得すること。

**令和6年 審議結果 PDF 命名例:**

| 会議 | ファイル名 |
| --- | --- |
| 第1回臨時会 | `R6_1_rinjikai_kekka.pdf` |
| 第2回臨時会 | `R6_2_rinjikai_kekka.pdf` |
| 第1回定例会 | `R6daiittkaigiketukettka.pdf` |
| 第2回定例会 | `reiwarokunenndai2kaiteireikaigiketukekka.pdf` |
| 第3回定例会 | `reiwarokunenndaisannkaiteireikaigiketukekka.pdf` |
| 第4回定例会 | `giketukekkareiwarokunenndaiyonnkai.pdf` |

→ ファイル名に一貫した命名規則はなく年度ごとに異なる。HTML ページの `<a>` タグから URL を取得すること。

#### 2. 一般質問事項 PDF

定例会ごとの一般質問通告書を PDF で公開。

| ページ種別 | URL パターン |
| --- | --- |
| 一般質問 年度インデックス | `https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/ippan/index.html` |
| 年度別ページ | `/admin/shoshiki/gikaijimu/ippan/{数値ID}.html` |
| PDF ファイル | `https://www.town.minamiise.lg.jp/material/files/group/16/{ファイル名}.pdf` |

**年度別ページ URL の例:**

| 年度 | ページ ID |
| --- | --- |
| 令和8年 | 7888 |
| 令和7年 | 7254 |
| 令和6年 | 6559 |
| 令和5年 | 5566 |
| 令和4年 | 4795 |
| 令和3年 | 3938 |
| 令和2年 | 3350 |
| 令和元年 | 2498 |

---

## PDF ファイルの格納場所

すべての PDF は以下のパスに格納されている。

```
https://www.town.minamiise.lg.jp/material/files/group/16/{ファイル名}.pdf
```

- `group/16` が議会事務局の格納ディレクトリ
- ファイル名は日本語ローマ字混在で命名規則が統一されていない

---

## スクレイピング戦略（審議結果・一般質問）

会議録本文は公開されていないため、審議結果および一般質問事項 PDF を取得対象とする場合の戦略を示す。

### Step 1: 年度別ページ ID の収集

審議結果インデックス (`/shingikekka/index.html`) または一般質問インデックス (`/ippan/index.html`) を取得し、年度別ページへのリンクを抽出する。

- 令和3年以降: `/shingikekka/{数値ID}.html` 形式
- 平成29年〜30年: `/shingikekka/h{年号2桁}/index.html` 形式
- ページネーションなし（全年度が単一ページに一覧表示）

### Step 2: 年度別ページから各会議ページへのリンクを収集

年度別インデックスページから各定例会・臨時会のページリンクを抽出する。

- 令和3年以降は年度別ページに直接 PDF リンクが掲載されている場合がある
- 平成29年以前は各会議ごとに個別ページがある構造

### Step 3: 各会議ページから PDF リンクを収集

各会議ページを取得し、PDF へのリンク（`//www.town.minamiise.lg.jp/material/files/group/16/*.pdf`）を抽出する。

- URL スキームが `//` で始まる場合は `https:` を補完する
- ファイル名はリンクテキストまたは直前のテキストから会議名を取得する

### Step 4: PDF のダウンロード

- ダウンロード済みの PDF は URL ベースで重複チェックして再取得しない
- レート制限: リクエスト間に 1〜2 秒の待機時間を設ける

---

## 注意事項

- **会議録本文は未公開**: 本会議の議事録テキストはオンラインで入手不可。必要な場合は議会事務局（南勢庁舎 TEL: 0599-66-1781）へ問い合わせが必要。
- **ファイル名の不規則性**: 命名規則が年度・担当者ごとに異なるため、ファイル名からメタ情報（年度・定例会回）を推測することは困難。HTML ページ上のリンクテキストから会議名を取得すること。
- **URL 形式の年代差異**: 令和3年以降と平成30年以前で年度別ページの URL 形式が異なる（数値 ID 形式 vs `h{年号2桁}` 形式）。
- **年度別ページ ID の予測不可**: CMS が割り当てた数値 ID のため、インデックスページから動的に取得すること。

---

## 推奨アプローチ

1. **会議録本文の代替収集は困難**: 本会議の議事録本文がオンライン未公開のため、スクレイピングで会議録テキストを収集することはできない。
2. **審議結果・一般質問の収集は可能**: 議決結果と一般質問通告書は PDF で公開されており、インデックスページを起点に取得できる。
3. **インデックスページを起点にする**: 年度別ページ ID をハードコードせず、毎回インデックスページから動的に取得する。
4. **HTML から PDF URL を取得**: ファイル名に頼らず、各ページの `<a>` タグの href と前後テキストを組み合わせてメタ情報を取得する。
