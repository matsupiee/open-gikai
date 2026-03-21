# 鹿島市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.saga-kashima.lg.jp/main/107.html
- 分類: 自治体独自 CMS（静的 HTML ページ + PDF 直接リンク）
- 文字コード: UTF-8
- 特記: Google Translate 対応、文字サイズ・背景色変更機能あり

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.city.saga-kashima.lg.jp/main/107.html` |
| 年度別一覧（令和7年） | `https://www.city.saga-kashima.lg.jp/main/35933.html` |
| 年度別一覧（令和6年） | `https://www.city.saga-kashima.lg.jp/main/35934.html` |
| 過去ログ一覧 | `https://www.city.saga-kashima.lg.jp/main/32950.html` |
| PDF ファイル（令和7年） | `https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2025/[ファイル名].pdf` |
| PDF ファイル（令和6年） | `https://www.city.saga-kashima.lg.jp/site_files/file/gikai/kaigiroku/2024/[ファイル名].pdf` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.city.saga-kashima.lg.jp/main/35933.html` |
| 令和6年 | `https://www.city.saga-kashima.lg.jp/main/35934.html` |
| 令和5年以前 | `https://www.city.saga-kashima.lg.jp/main/32950.html` から各年度へリンク |
| 最古（平成15年） | `https://www.city.saga-kashima.lg.jp/main/399.html` |

過去ログ一覧ページ（32950.html）から平成15年〜令和5年の各年度ページへ `./[数字].html` 形式で個別リンクされている。

---

## 会議録の提供形式

PDF 直接リンク形式。各定例会・臨時会ごとに複数の PDF ファイルが掲載される。

**PDF ファイル命名規則（令和7年の例）:**

| 文書種別 | ファイル名パターン |
| --- | --- |
| 目次 | `R0712　鹿島市（目次）.pdf` |
| 開会日 | `R07.11.28　鹿島市（開会）.pdf` |
| 一般質問 | `R7.12.04～17　鹿島市.pdf` |

- ファイル名は日本語（全角）で構成され、URL エンコードされている
- 年度表記は `R06`・`R07` などの和暦短縮形と `R7` が混在する場合がある

---

## 会議種別

| 種別 | 開催頻度 |
| --- | --- |
| 定例会 | 年4回（3月・6月・9月・12月） |
| 臨時会 | 不定期（例: 5月） |

各会議内で「目次」「開会日」「議案審議」「一般質問」「閉会日」「会議結果概要」の複数 PDF が提供される。

---

## ページネーション

なし。各年度ページ内に当該年の全会議録 PDF リンクが列挙される。

---

## スクレイピング戦略

### Step 1: 年度ページ URL の収集

1. トップページ（`/main/107.html`）から当年度のリンク（`35933.html` 等）を取得
2. 過去ログページ（`/main/32950.html`）から平成15年〜前年度の各年度ページ URL を取得
3. 合計約20年分（平成15年〜現在）の年度ページ URL リストを作成

### Step 2: 各年度ページから PDF リンクを収集

各年度ページの `<a href="...pdf">` リンクを抽出する。

- PDF URL は `/site_files/file/gikai/kaigiroku/{西暦年}/[ファイル名].pdf` 形式
- 1年度あたり20〜40件程度の PDF リンクが含まれる
- 「目次」「会議結果の概要」なども PDF で提供されるため、会議録本文のみを抽出する場合は日付パターン（`R07.MM.DD` 等）でフィルタリングする

### Step 3: PDF のダウンロードと解析

- PDF を取得してテキスト抽出
- ファイル名から開催日・会議種別を推定（例: `R07.11.28` → 令和7年11月28日）

---

## 注意事項

- PDF ファイル名に全角スペース（`%E3%80%80`）が含まれるため、URL デコード時に注意が必要
- 年度表記が `R06` と `R7` のように表記ゆれがある
- 平成15年（2003年）から掲載あり
