# 志賀町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shika.lg.jp/site/gikai/list23-19.html
- 分類: 独自 CMS による HTML 公開 + PDF 直リンク（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 専用の検索システムは使用されていない。年度別ページに PDF が直リンクされている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（年度リスト） | `https://www.town.shika.lg.jp/site/gikai/list23-19.html` |
| 年度別会議録ページ | `https://www.town.shika.lg.jp/site/gikai/{pageId}.html` |
| 会議録 PDF | `https://www.town.shika.lg.jp/uploaded/attachment/{id}.pdf` |

### 年度別ページの ID 対応

| 年度 | URL |
| --- | --- |
| 令和7年 | `/site/gikai/1080.html` |
| 令和6年 | `/site/gikai/1079.html` |
| 令和5年 | `/site/gikai/1078.html` |
| 令和4年 | `/site/gikai/1077.html` |
| 令和3年 | `/site/gikai/1076.html` |
| 令和2年 | `/site/gikai/1075.html` |
| 平成31年・令和元年 | `/site/gikai/1074.html` |
| 平成30年 | `/site/gikai/1060.html` |
| 平成29年 | `/site/gikai/1061.html` |
| 平成28年 | `/site/gikai/1062.html` |
| 平成27年 | `/site/gikai/1063.html` |
| 平成26年 | `/site/gikai/1064.html` |
| 平成25年 | `/site/gikai/1065.html` |
| 平成24年 | `/site/gikai/1066.html` |
| 平成23年 | `/site/gikai/1067.html` |
| 平成22年 | `/site/gikai/1068.html` |
| 平成21年 | `/site/gikai/1069.html` |
| 平成20年 | `/site/gikai/1070.html` |
| 平成19年 | `/site/gikai/1071.html` |
| 平成18年 | `/site/gikai/1072.html` |
| 平成17年 | `/site/gikai/1073.html` |

---

## スクレイピング戦略

### Step 1: 年度ページ URL の収集

会議録一覧ページ `list23-19.html` から年度別ページへのリンクを抽出する。

- ページネーションなし（全年度が1ページに収まっている）
- リンクは `/site/gikai/{pageId}.html` 形式
- リンクテキストは「令和X年 議会会議録」「平成XX年 議会会議録」形式

**収集方法:**

1. `list23-19.html` を取得し、`/site/gikai/\d+\.html` にマッチするリンクを Cheerio で抽出
2. 年度別ページの URL リストを生成

### Step 2: 各年度ページから PDF リンクを収集

各年度ページにアクセスし、会議録 PDF へのリンクを抽出する。

- 会議は定例会（年4回）と臨時会で構成される
- 各回の会議は複数日（通常3日）に分かれており、各日に PDF が1つ存在する
- PDF のリンクは `/uploaded/attachment/{id}.pdf` 形式

**抽出情報:**

- PDF URL: `href` 属性
- 会議名（例: 「第1回定例会」「第1回臨時会」）: リンク周辺のテキストまたは見出し
- 開催日（例: 「令和6年3月12日」「03月12日（1日目）」）: リンクテキスト

### Step 3: PDF のダウンロードとテキスト抽出

取得した PDF URL から会議録 PDF をダウンロードし、テキストを抽出する。

---

## HTML 構造

### 会議録一覧ページ (`list23-19.html`)

```html
<!-- 年度別リンクがリスト形式で並ぶ -->
<a href="/site/gikai/1079.html">令和6年 議会会議録</a>
<a href="/site/gikai/1078.html">令和5年 議会会議録</a>
...
```

### 年度別会議録ページ

```html
<!-- 定例会・臨時会ごとに区切られ、各日程のPDFにリンク -->
<!-- 例: 令和6年 -->
<a href="/uploaded/attachment/1417.pdf">令和6年3月12日</a>  <!-- 第1回定例会 1日目 -->
<a href="/uploaded/attachment/1418.pdf">令和6年3月19日</a>  <!-- 第1回定例会 2日目 -->
...
<a href="/uploaded/attachment/1423.pdf">令和6年8月27日</a>  <!-- 第3回定例会 1日目 -->
```

---

## 会議の種類と構成

- **定例会**: 年4回（第1回〜第4回）、各回3日程度
- **臨時会**: 年数回開催（年度によって異なる）

---

## 利用可能期間

平成17年（2005年）〜令和7年（2025年）

---

## 注意事項

- 年度別ページの ID（1060〜1080）は連番ではなく、年度と ID の対応は一覧ページから動的に取得する必要がある
- 平成31年と令和元年は同一ページ（`/site/gikai/1074.html`）にまとめられている
- PDF ファイルサイズは数十 KB〜数 MB の範囲で、複数ページのスキャン PDF が含まれる可能性あり
- レート制限: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **一覧ページから動的に年度 URL を収集**: ページ ID はハードコードせず、`list23-19.html` から取得する
2. **各年度ページで PDF リンクを抽出**: 会議名・日付と PDF URL を紐づけて収集
3. **PDF をダウンロードしてテキスト抽出**: PDF パーサーで本文テキストを取り出す
4. **差分更新**: 最新年度のページのみ再取得することで効率的な更新が可能
