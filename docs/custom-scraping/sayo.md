# 佐用町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.sayo.lg.jp/cms-sypher/www/gov/result.jsp?life_genre=157
- 分類: 町公式サイト独自 CMS（cms-sypher）による PDF 掲載
- 文字コード: UTF-8
- 特記: 外部の会議録検索システムは未導入。年度別一覧ページから PDF を直接リンク。会議録は平成17年10月合併以降から公開。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録カテゴリトップ（最新5件） | `https://www.town.sayo.lg.jp/cms-sypher/www/gov/result.jsp?life_genre=157` |
| 会議録全件一覧 | `https://www.town.sayo.lg.jp/cms-sypher/www/info/result.jsp?life_supergenre=4&life_genre=157&p={ページ番号}` |
| 年度別詳細ページ | `https://www.town.sayo.lg.jp/cms-sypher/www/info/detail.jsp?id={ID}` |
| 会議録 PDF | `https://www.town.sayo.lg.jp/gikai/kaigiroku/R{年号}nen/{会議種別}_{回次}/{ファイル名}.pdf` |

---

## 年度別詳細ページの ID

| 年度 | ID |
| --- | --- |
| 令和8年 | 12067 |
| 令和7年 | 11060 |
| 令和6年 | 9544 |
| 令和5年 | 8513 |
| 平成18年（最古） | 801 |

※ 全件一覧ページからページネーション（`p=` パラメータ）で全 ID を収集可能。

---

## 会議種別

| 種別 | URL 内表記 |
| --- | --- |
| 定例会 | `teirei` |
| 臨時会 | `rinji` |

年4回の定例会（3月・6月・9月・12月）と随時の臨時会が開催される。

---

## PDF ファイル名の命名規則

```
/gikai/kaigiroku/R{年号}nen/{会議種別}_{回次}/{ファイル名}.pdf
```

| 要素 | 説明 | 例 |
| --- | --- | --- |
| `R{年号}nen` | 令和年号（2桁） | `R6nen`（令和6年）、`R7nen`（令和7年） |
| `{会議種別}_{回次}` | 会議種別と通し番号 | `teirei_115`、`rinji_116` |
| `{ファイル名}` | 種別+回次+日目 | `teirei115-1.pdf`〜`teirei115-5.pdf` |

### ファイル命名規則の例

| パターン | 例 |
| --- | --- |
| 定例会 | `teirei{回次}-{日目}.pdf` | `teirei115-1.pdf`（第115回 1日目） |
| 臨時会 | `rinji{回次}-{日目}.pdf` | `rinji116-1.pdf`（第116回 1日目） |

---

## HTML 構造

### 全件一覧ページ

```
a[href="../info/detail.jsp?id={ID}"] "{年度}年開催分"
  [YYYY年M月D日（曜日）HH時MM分] [所属部署：議会事務局]
```

### 年度別詳細ページ

各年度ページに定例会・臨時会の一覧が表示される。

```
table or section
  "第{回次}回{種別}会"
    ul > li
      a[href="{PDFパス}"] "{N}日目 (PDFファイル: {サイズ}KB)"
```

リンクテキスト形式の例:
- `1日目 (PDFファイル: 850KB)`

---

## スクレイピング戦略

### Step 1: 年度別 ID の収集

全件一覧ページをページネーションで全件クロールし、年度別詳細ページの ID を収集する。

```typescript
// ページネーション
const baseUrl = "https://www.town.sayo.lg.jp/cms-sypher/www/info/result.jsp";
const params = "?life_supergenre=4&life_genre=157";
for (let page = 1; ; page++) {
  const url = `${baseUrl}${params}&p=${page}`;
  // a[href*="detail.jsp?id="] から ID を抽出
  // 記事がなくなったらループ終了
}
```

### Step 2: 年度別ページから PDF リンクを収集

各年度詳細ページにアクセスし、会議録 PDF へのリンクと会議名を収集する。

```typescript
// PDF リンクの抽出
// a[href$=".pdf"] でリンクを取得
// 直前の見出し（会議名）と対応付け

// 会議名から回次・種別を抽出
const sessionPattern = /第(\d+)回(定例会|臨時会)/;

// リンクテキストから日目を抽出
const dayPattern = /(\d+)日目/;
```

### Step 3: PDF のダウンロードとテキスト抽出

- URL パターン: `https://www.town.sayo.lg.jp/gikai/kaigiroku/R{年号}nen/{種別}_{回次}/{ファイル名}.pdf`
- PDF からのテキスト抽出には `pdf-parse` 等のライブラリを使用

---

## ページネーション

**全件一覧ページ**: あり（`p=` パラメータで制御）

記事総数は23件程度（令和8年2月時点）。1ページあたりの表示件数は10〜20件程度。

**年度別詳細ページ**: なし。当該年度の全会議録が1ページに表示される。

---

## 注意事項

- PDF URL は年度別詳細ページの HTML から取得するのが確実（ファイル命名規則から予測も可能だが、日目数が年度・会議により異なる）
- 平成年度（平成17年〜令和元年）の PDF URL パターンが令和年度と異なる可能性があるため、実際の HTML を確認して更新が必要
- 会議の回次は通し番号のため、年度をまたいで連番が続く

---

## 推奨アプローチ

1. **全件一覧からの ID 収集**: ページネーションで全年度の詳細ページ ID を収集し、新規追加を検出する
2. **PDF リンクは HTML から抽出**: ファイル命名規則から推測するより、年度詳細ページの HTML から直接 PDF URL を抽出する方が確実
3. **PDF テキスト抽出**: `pdf-parse` や `pdfjs-dist` を使用
4. **レート制限**: リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 年度別ページを定期的にチェックし、新規追加された PDF のみをダウンロードする
