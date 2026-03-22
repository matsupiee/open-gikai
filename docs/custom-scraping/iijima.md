# 飯島町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.iijima.lg.jp/soshikiichiran/gikaijimukyoku/gikai/gikai_kuroku/91.html
- 分類: 自治体公式サイト上の静的 HTML ページに PDF リンクを一覧掲載（検索システムなし）
- 文字コード: UTF-8
- 会議録形式: PDF
- 提供期間: 平成17年（2005年）〜現在
- 会議種別: 定例会（3月・6月・9月・12月）、臨時会（不定期）

---

## URL 構造

| ページ | URL |
| --- | --- |
| 会議録一覧（単一ページ） | `https://www.town.iijima.lg.jp/soshikiichiran/gikaijimukyoku/gikai/gikai_kuroku/91.html` |
| PDF ファイル | `https://www.town.iijima.lg.jp/material/files/group/10/{ファイル名}.pdf` |

- 全年度・全会議の PDF リンクが **1 ページに集約** されている（ページネーションなし）
- PDF の URL はプロトコル相対パス（`//www.town.iijima.lg.jp/...`）で記述されている

---

## HTML 構造

### ページ階層

```
div.free-layout-area
  └ h2: "{年号}年議会議事録"（年度ごとのセクション）
      ├ h3: "定例会議事録"
      │   └ p.file-link-item > a.pdf[href="...*.pdf"]
      │     （リンクテキスト例: "令和7年3月議会定例会 (PDFファイル: 2.4MB)"）
      └ h3: "臨時会議事録"
          └ p.file-link-item > a.pdf[href="...*.pdf"]
            （リンクテキスト例: "令和7年第1回臨時会 (PDFファイル: 440.7KB)"）
```

### PDF リンクの HTML 例

```html
<h2><span class="bg"><span class="bg2"><span class="bg3">令和7年議会議事録</span></span></span></h2>
<h3><span class="bg"><span class="bg2"><span class="bg3">定例会議事録</span></span></span></h3>
<p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/R7_3_gikaiteireikai.pdf">令和7年3月議会定例会 (PDFファイル: 2.4MB)</a></p>
<p class="file-link-item"><a class="pdf" href="//www.town.iijima.lg.jp/material/files/group/10/teireikai0706.pdf">令和7年6月議会定例会 (PDFファイル: 2.8MB)</a></p>
```

### 特徴

- `a` タグに `class="pdf"` が付与されている → セレクタ `a.pdf` で全 PDF リンクを取得可能
- `p.file-link-item` で各リンクがラップされている
- リンクテキストに会議名・ファイルサイズが含まれる
- 見出し（h2/h3）は `span.bg > span.bg2 > span.bg3` の三重ラッパー構造
- 現在の PDF 数: 約 145 件

---

## PDF ファイル名の命名規則

ファイル名に **統一的な命名規則はない**。年代や担当者によって異なるパターンが混在する。

| 年代 | ファイル名の例 | 傾向 |
| --- | --- | --- |
| 令和7年 | `R7_3_gikaiteireikai.pdf`, `teireikai0706.pdf`, `R7-1rinji.pdf` | 年号略記 + 月 + 種別 |
| 令和4〜6年 | `R6gikai.pdf`, `cleanedR0403teireikaigijiroku.pdf` | `cleaned` 接頭辞あり |
| 平成17〜20年 | `56661237.pdf`, `61034208.pdf` | 8桁数字（ID的） |
| 平成21年以降 | `H2103teireikai.pdf`, `h24-6gijiroku.pdf` | 年号 + 月 + 種別 |

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

一覧ページ `91.html` から全 PDF リンクとメタ情報を抽出する。

**収集方法:**

1. `https://www.town.iijima.lg.jp/soshikiichiran/gikaijimukyoku/gikai/gikai_kuroku/91.html` を取得
2. `a.pdf` セレクタで全 PDF リンクを抽出
3. 各リンクについて以下を取得:
   - PDF の URL（`href` 属性、プロトコル相対パスなので `https:` を補完）
   - リンクテキスト（会議名の抽出に使用）
4. 直前の `h2`（年度）と `h3`（定例会/臨時会）から所属セクションを判定

**リンクテキストからのメタ情報抽出:**

```typescript
// リンクテキスト例: "令和7年3月議会定例会 (PDFファイル: 2.4MB)"
// リンクテキスト例: "令和7年第1回臨時会 (PDFファイル: 440.7KB)"

// 定例会パターン
const teireikaiPattern = /^(.+?)年(\d+)月議会定例会/;
// 例: "令和7年3月議会定例会" → era="令和7", month="3"

// 臨時会パターン
const rinjikaiPattern = /^(.+?)年第(\d+)回臨時会/;
// 例: "令和7年第1回臨時会" → era="令和7", kai="1"

// ファイルサイズの除去
const namePattern = /^(.+?)\s*\(PDFファイル:.+?\)$/;
```

### Step 2: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF は定例会で 2〜5MB 程度、臨時会で 300KB〜700KB 程度
- テキスト抽出には PDF パーサーを使用（pdf-parse 等）
- 平成17〜20年頃の古い PDF は画像ベースの可能性あり → OCR が必要になるケースに注意

### Step 3: テキストのパース

PDF から抽出したテキストの構造は PDF ごとに異なる可能性が高い。基本的な想定:

- 会議録は通常、開会日時・出席議員・議事内容の順で構成
- 発言者と発言内容の区切りパターンは PDF の書式に依存

---

## 注意事項

- PDF ファイル名に統一性がないため、ファイル名からのメタ情報抽出は**リンクテキストを優先**する
- プロトコル相対パス（`//www.town.iijima.lg.jp/...`）を `https://www.town.iijima.lg.jp/...` に変換する必要がある
- 平成20年以前の PDF は 8 桁数字のファイル名で、ファイル名からは会議情報を判別不可能
- 全データが単一ページに掲載されているため、ページネーション処理は不要
- 平成17〜19年は定例会のみ掲載（臨時会の記録なし）、平成20年も定例会のみ

---

## 推奨アプローチ

1. **単一ページ取得で完結**: 一覧ページ 1 回の取得で全 PDF URL を収集可能
2. **リンクテキストからメタ情報を抽出**: ファイル名ではなくリンクテキストの会議名を正規表現でパースして年度・月・会議種別を取得
3. **h2/h3 の文脈を利用**: DOM の親見出しから年度（h2）と定例会/臨時会（h3）の分類を補完的に取得
4. **レート制限**: PDF ダウンロード時はリクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 一覧ページの PDF リンク数の増減、または最新の h2 セクション内のリンクのみを確認して差分検出
