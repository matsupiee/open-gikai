# 土庄町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/index.html
- 分類: 独自 CMS（Smart CMS）による HTML 公開、会議録本文は PDF ファイル
- 文字コード: UTF-8
- 対象期間: 平成23年〜令和7年
- 特記: 令和4年6月定例会以降は YouTube 動画配信（https://www.youtube.com/@tonosho_gikai）も提供

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/index.html` |
| 年度別一覧（令和3年〜令和7年） | `https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa{N}/index.html` |
| 会議別ページ（令和3年〜令和7年） | `https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/reiwa{N}/{N}_{月}gatu.html` |
| 年度別一覧（令和2年以前） | `https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/{数字ID}.html` |
| 会議録 PDF | `https://www.town.tonosho.kagawa.jp/material/files/group/13/{ファイル名}.pdf` |

---

## 年度別 URL 対応表

### 令和（reiwa フォルダ形式）

| 年度 | URL |
| --- | --- |
| 令和7年 | `.../kaigiroku/reiwa7/index.html` |
| 令和6年 | `.../kaigiroku/reiwa6/index.html` |
| 令和5年 | `.../kaigiroku/reiwa5/index.html` |
| 令和4年 | `.../kaigiroku/reiwa4/index.html` |
| 令和3年 | `.../kaigiroku/reiwa3/index.html` |

### 令和2年以前（数字 ID 形式）

| 年度 | URL |
| --- | --- |
| 令和2年 | `.../kaigiroku/1578.html` |
| 令和元年（平成31年） | `.../kaigiroku/178.html` |
| 平成30年 | `.../kaigiroku/209.html` |
| 平成29年 | `.../kaigiroku/210.html` |
| 平成28年 | `.../kaigiroku/212.html` |
| 平成27年 | `.../kaigiroku/214.html` |
| 平成26年 | `.../kaigiroku/215.html` |
| 平成25年 | `.../kaigiroku/216.html` |
| 平成24年 | `.../kaigiroku/217.html` |
| 平成23年 | `.../kaigiroku/218.html` |

---

## ページ構造の違い（新旧フォーマット）

### 新フォーマット（令和3年〜令和7年）：3 層構造

```
年度一覧ページ（reiwa{N}/index.html）
  └─ 会議別ページ（{N}_{月}gatu.html）
       ├─ 全文 PDF（日付ごとに複数）
       ├─ 一般質問 PDF（議員名ごとに個別）
       └─ 委員長報告 PDF（委員会ごとに個別）
```

会議別ページの HTML 構造:

```
h1: 「{月}月{定例会|臨時会}の会議録」
h2: 「全文」
  h3: 「{月}月{日}日」
    ul > li > a → 全文 PDF
h2: 「一般質問」
  h3: 「{議員名}」
    ul > li > a → 一般質問 PDF
h2: 「委員長報告」（または「閉会中の委員会活動報告」）
  h3: 「{委員会名}」
    ul > li > a → 委員会報告 PDF
```

### 旧フォーマット（令和2年以前）：2 層構造

```
年度ページ（{数字ID}.html）
  └─ 各会議・各日付の PDF が直接リンク
```

年度ページの HTML 構造:

```
h3: 「{月}月{定例会|臨時会}」
  a → PDF（リンクテキストに開催日を記載）
```

---

## 会議の種類

定例会と臨時会が混在する。会議は年4回の定例会（3月・6月・9月・12月）を基本とし、年によっては臨時会（1月・5月・7月・11月など）が追加される。

---

## PDF ファイル命名規則

PDF ファイル名は統一されたルールがなく、年度・会議ごとに異なる命名が使われている。

**新フォーマット（令和3年〜令和7年）の例:**

| 種別 | ファイル名例 |
| --- | --- |
| 全文（令和7年6月定例会） | `gikai7-6-1.pdf`, `kaigi7-6-2.pdf` |
| 全文（令和7年3月定例会） | `gigiroku7-1.pdf`, `kaigiroku7-3-2.pdf` |
| 一般質問（令和7年6月） | `ipan7-6-1.pdf`, `ip7-6.pdf` |
| 委員長報告（令和7年6月） | `houkoku7-6-1.pdf`, `houko7-6-2.pdf` |
| 全文（令和4年6月定例会） | `R4_6kaigiroku1.pdf`, `R4_6kaigiroku2.pdf` |
| 一般質問（令和4年6月） | `R4_6situmon_oonokazuyuki.pdf` |

**旧フォーマット（令和2年以前）の例:**

| 種別 | ファイル名例 |
| --- | --- |
| 平成23年各会議 | `218_1.pdf`, `218_2.pdf`, ..., `218_16.pdf` |
| 令和2年各会議 | `teireikaigiroku4.pdf`, `r2_6teireikai17.pdf` |

---

## スクレイピング戦略

### Step 1: 年度別ページの URL リストを構築

会議録トップページ（`index.html`）から年度別 URL を抽出する。

- 令和3年〜令和7年: `reiwa{N}/index.html` 形式（`N` = 3〜7）
- 令和2年以前: ページ内リンクから数字 ID 形式の URL を抽出

### Step 2: 会議別ページの URL リストを構築

**新フォーマット（令和3年〜令和7年）:**

年度一覧ページ（`reiwa{N}/index.html`）から会議別ページへのリンクを抽出する。

- リンクは `<ul><li><a>` 形式で列挙される
- 表示テキストは `{月}月{定例会|臨時会}の会議録`

**旧フォーマット（令和2年以前）:**

年度ページに直接 PDF リンクが含まれるため、Step 3 に直接進む。

### Step 3: PDF リンクの収集

**新フォーマット（会議別ページから）:**

Cheerio で各会議別ページをパースし、`h2` セクションごとに PDF リンクを分類して収集する。

- `h2` テキスト「全文」配下: 会議録全文 PDF（日付ごと）
- `h2` テキスト「一般質問」配下: 議員名ごとの一般質問 PDF
- `h2` テキスト「委員長報告」または「閉会中の委員会活動報告」配下: 委員会報告 PDF

**旧フォーマット（年度ページから）:**

年度ページ内の全 PDF リンクを `h3` のセクション見出し（会議名）と紐付けて収集する。

### Step 4: PDF のダウンロードとテキスト抽出

すべての PDF は `https://www.town.tonosho.kagawa.jp/material/files/group/13/` 配下に格納されている。

PDF からテキストを抽出し、発言者・発言内容・メタ情報（開催日、会議名）を解析する。

---

## PDF 内の構造

会議録 PDF の内容は HTML ではなくスキャン画像 PDF ではなくテキスト PDF と想定されるが、実際の PDF 内部構造は目視確認が必要。以下は HTML インデックスページから推定できるメタ情報:

| 情報 | 取得元 |
| --- | --- |
| 開催年度 | 年度フォルダ名または数字 ID |
| 会議名 | 会議別ページの `h1` または年度ページの `h3` |
| 開催日 | リンクテキストまたは `h3` の日付表記 |
| 種別（全文/一般質問/委員長報告） | `h2` セクション見出し |
| 議員名（一般質問の場合） | `h3` の議員名 |

---

## 注意事項

- PDF ファイル名に規則性がないため、ファイル名からメタ情報を推定することは困難。HTML インデックスページから取得したメタ情報（会議名、日付、議員名）を PDF URL と紐付けて管理する必要がある。
- 令和4年6月定例会以降の YouTube 動画リンクは、調査時点でインデックスページには含まれていなかった（YouTube チャンネルへの案内のみ）。
- HTTP と HTTPS が混在している（旧フォーマットページは HTTP のリンクを使用）。スクレイピング時は HTTPS に統一するか、リダイレクトを許容する設定が必要。
- `material/files/group/13/` の PDF は直接アクセス可能だが、Referer ヘッダーが必要な場合に備えてインデックスページの URL を Referer に設定することを推奨。
- レート制限: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける。

---

## 推奨アプローチ

1. **トップページから全年度 URL を収集**: 静的リンクのため定期的な再取得は不要だが、新年度追加時に更新する
2. **会議別メタデータを HTML から構築**: PDF ダウンロード前に URL・会議名・日付・種別・議員名のマッピングテーブルを作成する
3. **PDF のテキスト抽出検証**: 複数の年度・会議から PDF をサンプリングし、テキスト PDF かスキャン PDF かを確認してから本格取得に進む
4. **旧フォーマットと新フォーマットで別ロジックを用意**: Step 2〜3 の処理が異なるため、年度によって分岐する
