# 平内町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.hiranai.aomori.jp/soshiki/gikai/1/1/594.html
- 分類: 町公式サイトで会議録を PDF 形式で公開（SMART CMS）
- 文字コード: UTF-8
- 特記: 定例会会議録のみ掲載。令和3年（2021年）〜令和7年（2025年）の会議録が対象。検索機能なし

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.hiranai.aomori.jp/soshiki/gikai/1/1/594.html` |
| PDF ファイル | `https://www.town.hiranai.aomori.jp/material/files/group/14/{ファイル名}.pdf` |

---

## ページ構造

### 会議録一覧ページ（594.html）

全年度・全会議録が 1 ページにまとめて掲載されている。年度ごとに見出しで区切られ、各定例会の PDF リンクが並ぶ。

- ページネーションなし
- 検索機能なし
- 全 PDF リンクが単一ページ内に存在

### 年度・会議録の構成

各年度につき年4回の定例会（第1回〜第4回）が掲載されている。

| 年度 | 掲載回数 | 開催月 |
| --- | --- | --- |
| 令和7年（2025年） | 4回 | 3月、6月、9月、12月 |
| 令和6年（2024年） | 4回 | 2月、6月、9月、12月 |
| 令和5年（2023年） | 4回 | 同上 |
| 令和4年（2022年） | 4回 | 同上 |
| 令和3年（2021年） | 4回 | 同上 |

---

## PDF リンク一覧

### 令和7年（2025年）

| リンクテキスト | URL |
| --- | --- |
| 第1回（3月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_1st_meeting_in_2025.pdf` |
| 第2回（6月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_2nd_meeting_in_2025.pdf` |
| 第3回（9月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_3rd_meeting_in_2025.pdf` |
| 第4回（12月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_4th_meeting_in_2025.pdf` |

### 令和6年（2024年）

| リンクテキスト | URL |
| --- | --- |
| 第1回（2月） | `//www.town.hiranai.aomori.jp/material/files/group/14/2024_1st_meeting.pdf` |
| 第2回（6月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_2nd_meeting_in_2024.pdf` |
| 第3回（9月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_3rd_meeting_in_2024_2.pdf` |
| 第4回（12月） | `//www.town.hiranai.aomori.jp/material/files/group/14/minutes_of_the_4th_meeting_in_2024.pdf` |

### 令和5年（2023年）

| リンクテキスト | URL |
| --- | --- |
| 第1回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa5nendai1kaiteireikai.pdf` |
| 第2回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa5nendai2kaiteireikai2.pdf` |
| 第3回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa5nendai3kai.pdf` |
| 第4回 | `//www.town.hiranai.aomori.jp/material/files/group/14/r5dai4kaiteireikaikaigiroku.pdf` |

### 令和4年（2022年）

| リンクテキスト | URL |
| --- | --- |
| 第1回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa4nendai1kai.pdf` |
| 第2回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa4nendai2kaiteireikai.pdf` |
| 第3回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa4nendai3kaiteireikai.pdf` |
| 第4回 | `//www.town.hiranai.aomori.jp/material/files/group/14/reiwa4nendai4kaiteireikai.pdf` |

### 令和3年（2021年）

| リンクテキスト | URL |
| --- | --- |
| 第1回 | `//www.town.hiranai.aomori.jp/material/files/group/14/20220520-105715.pdf` |
| 第2回 | `//www.town.hiranai.aomori.jp/material/files/group/14/20220520-110016.pdf` |
| 第3回 | `//www.town.hiranai.aomori.jp/material/files/group/14/20220520-110231.pdf` |
| 第4回 | `//www.town.hiranai.aomori.jp/material/files/group/14/20220520-110610.pdf` |

---

## PDF ファイル名の命名規則

ファイル名に統一的な規則はなく、年度によって命名パターンが異なる。

| 年度 | 命名パターン | 例 |
| --- | --- | --- |
| 令和7年 | 英語表記 | `minutes_of_the_1st_meeting_in_2025.pdf` |
| 令和6年 | 英語表記（一部異なる） | `2024_1st_meeting.pdf`, `minutes_of_the_2nd_meeting_in_2024.pdf` |
| 令和5年 | ローマ字表記 | `reiwa5nendai1kaiteireikai.pdf` |
| 令和4年 | ローマ字表記 | `reiwa4nendai1kai.pdf` |
| 令和3年 | タイムスタンプ | `20220520-105715.pdf` |

ファイル名から会議の回次や年度を推測することは困難なため、一覧ページのリンクテキストからメタ情報を取得する必要がある。

---

## 会議種別

定例会のみが掲載されている。臨時会の会議録は未確認。

---

## 掲載年度範囲

令和3年（2021年）〜 令和7年（2025年）

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF リンクの収集

会議録一覧ページ `594.html` を取得し、PDF へのリンク（`a[href$=".pdf"]`）をすべて収集する。

- 全リンクが単一ページ内に存在するため、ページネーション処理は不要
- 1 リクエストで全 PDF の URL を取得可能

### Step 2: リンクテキストからメタ情報の抽出

リンクテキストおよび周辺の見出し要素から以下の情報を抽出する。

- 年度（令和N年）
- 定例会の回次（第N回）
- 開催月

```typescript
// 年度の見出しから抽出
const yearPattern = /令和(\d+)年/;

// リンクテキストから回次と月を抽出
const meetingPattern = /第(\d+)回[（(](\d+)月[)）]/;
```

### Step 3: PDF のダウンロードとテキスト抽出

1. 収集した PDF URL からファイルをダウンロード（プロトコル相対 URL `//www.town...` のため `https:` を付与）
2. PDF テキスト抽出ツール（pdf-parse 等）でテキスト化
3. テキストから発言者と発言内容をパース

---

## 注意事項

- **プロトコル相対 URL**: PDF リンクが `//www.town.hiranai.aomori.jp/...` 形式（プロトコル省略）のため、`https:` を先頭に付与してアクセスする必要がある
- **ファイル名の不規則性**: 年度によって命名規則が異なるため、ファイル名から会議情報を推測せず、一覧ページのリンクテキストと見出しからメタ情報を取得する
- **PDF のみの公開**: HTML 形式の会議録は存在せず、すべて PDF。テキスト抽出の精度に依存する
- **SMART CMS**: 町の公式サイトは SMART CMS で構築されており、URL 構造は CMS のパス体系（`/soshiki/gikai/1/1/594.html`）に従う

---

## 推奨アプローチ

1. **一覧ページを起点にする**: `594.html` の 1 リクエストで全 PDF の URL を収集できる
2. **見出しとリンクテキストの組み合わせ**: 年度は見出し要素から、回次・月はリンクテキストから取得する
3. **プロトコル補完**: URL に `https:` を付与してからダウンロードする
4. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
5. **差分更新**: 既取得 URL のリストと比較し、新規 URL のみを取得する
