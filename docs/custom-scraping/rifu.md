# 利府町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/index.html
- 分類: 年度別ページに PDF リンクを掲載（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で公開。HTML の会議録検索システムは存在しない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/index.html` |
| 年度別ページ | `https://www.town.rifu.miyagi.jp/gyosei/chosei/rifuchogikai/2/{ID}.html` |
| PDF ファイル | `https://www.town.rifu.miyagi.jp/material/files/group/{groupID}/{filename}.pdf` |

### 年度別ページの URL 一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `/gyosei/chosei/rifuchogikai/2/6679.html` |
| 令和6年 | `/gyosei/chosei/rifuchogikai/2/6041.html` |
| 令和5年 | `/gyosei/chosei/rifuchogikai/2/5591.html` |
| 令和4年 | `/gyosei/chosei/rifuchogikai/2/kaigirokur4.html` |
| 令和3年 | `/gyosei/chosei/rifuchogikai/2/3740.html` |
| 令和2年 | `/gyosei/chosei/rifuchogikai/2/2889.html` |
| 令和元年 | `/gyosei/chosei/rifuchogikai/2/1899.html` |
| 平成30年 | `/gyosei/chosei/rifuchogikai/2/1910.html` |
| 平成29年 | `/gyosei/chosei/rifuchogikai/2/1913.html` |
| 平成28年 | `/gyosei/chosei/rifuchogikai/2/1912.html` |
| 平成27年 | `/gyosei/chosei/rifuchogikai/2/1914.html` |

※ URL の ID 部分に規則性はない（数値 ID またはスラッグ）。年度ページが追加されるたびにトップページから新しいリンクを収集する必要がある。

---

## 会議種別

年度によって多少の差異があるが、以下の会議種別が掲載されている:

| 会議種別 | 備考 |
| --- | --- |
| 定例会（3月・6月・9月・12月） | 年4回開催 |
| 臨時会 | 不定期（1月、7月、9月等） |
| 予算審査特別委員会 | 3月定例会に付随 |
| 決算審査特別委員会 | 9月定例会に付随 |

---

## ページ構造

### トップページ（年度一覧）

- 年度別のリンクが一覧表示される
- 平成27年〜令和7年（2015年〜2025年）の11年度分
- ページネーションなし

### 年度別ページ

- 冒頭に会議の開催期間をまとめた `<table>` がある（名称・開催期間の2列）
- 会議種別ごとに `<h2>` 見出しでセクション分割
- 各セクション内に PDF へのリンクが並ぶ

#### PDF リンクの構造

```html
<a href="//www.town.rifu.miyagi.jp/material/files/group/57/20241203-1teireikai.pdf">
  令和6年12月3日 (PDFファイル: 752.1KB)
</a>
```

- リンクテキストに和暦の日付が含まれる（例: `令和6年12月3日`）
- 括弧内にファイルサイズが記載される
- href はプロトコル相対 URL（`//www.town.rifu.miyagi.jp/...`）

#### PDF ファイル名のパターン

ファイル名に統一的な命名規則はない:

- `20241203-1teireikai.pdf`（日付 + 連番 + 会議種別ローマ字）
- `20240903teireikai.pdf`（日付 + 会議種別ローマ字）
- `r6-03t-01-0304-22.pdf`（年号略称 + 月 + 連番 + 日付）
- `060306yosannsinnsa-1.pdf`（年月日 + 会議種別ローマ字 + 連番）
- `20240126rinnjikai.pdf`（日付 + 会議種別ローマ字）

※ ファイル名からのメタ情報抽出は不安定。リンクテキストの日付を正として使用する。

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `index.html` から各年度ページへのリンクを収集する。

- `<a>` タグの href から `/gyosei/chosei/rifuchogikai/2/*.html` パターンのリンクを抽出
- `index.html` 自身は除外する

### Step 2: PDF リンクの収集

各年度ページから PDF リンクとメタ情報を収集する。

1. `<h2>` 見出しから会議種別名を取得（例: `令和6年12月定例会`）
2. 各セクション内の `<a>` タグから PDF の URL とリンクテキストを抽出
3. リンクテキストから開催日を抽出

**会議種別名からのメタ情報抽出:**

```typescript
// 会議名パターン（h2 見出し）
const sessionPattern = /^(令和|平成)(\d+)年(\d+)月(定例会|臨時会)$/;
const committeePattern = /^(予算審査|決算審査)特別委員会$/;
```

**リンクテキストからの日付抽出:**

```typescript
// リンクテキストの日付パターン
const datePattern = /(令和|平成)(\d+)年(\d+)月(\d+)日/;
// 例: "令和6年12月3日 (PDFファイル: 752.1KB)" → 令和6年12月3日
```

### Step 3: PDF のダウンロードとテキスト抽出

- PDF をダウンロードし、pdf-parse 等のライブラリでテキストを抽出する
- PDF 内のテキスト構造は個別に解析が必要（発言者パターン等は PDF 内容に依存）

### Step 4: 会議録テキストのパース

PDF から抽出したテキストについて、以下のパースを行う:

- 発言者パターンの検出（PDF 内容の実調査後に正規表現を確定）
- 議事内容の構造化

※ PDF のテキスト構造は実際にダウンロードして確認する必要がある。HTML ベースの会議録と異なり、PDF のレイアウトによってパース方法が大きく変わる。

---

## 注意事項

- PDF の group ID が年度によって異なる（平成27年は `group/19`、令和6年は `group/57`）
- URL はプロトコル相対（`//www.town.rifu.miyagi.jp/...`）で記載されるため、`https:` を付加する必要がある
- 年度ページの URL に規則性がないため、トップページからのリンク収集が必須
- PDF ファイル名の命名規則が統一されていないため、ファイル名からのメタ情報抽出は避ける

---

## 推奨アプローチ

1. **2段階クロール**: トップページ → 年度ページ → PDF の順にクロールする
2. **メタ情報はHTMLから取得**: 会議種別は `<h2>` 見出し、開催日はリンクテキストから取得する（PDF ファイル名は信頼しない）
3. **PDF テキスト抽出**: `pdf-parse` や `pdfjs-dist` を使用してテキストを抽出する
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: トップページの年度リンク一覧を確認し、新規年度ページが追加された場合のみ該当年度をクロールする
