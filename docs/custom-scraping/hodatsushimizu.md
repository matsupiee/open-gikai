# 宝達志水町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/index.html
- 分類: 町公式サイトによる年度別 PDF 公開（会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 専用の会議録検索システムは存在せず、町公式サイトの議会事務局ページで年度別に PDF を直接公開している

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年度一覧 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/index.html` |
| 年度別会議録ページ | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/{ページID}.html` |
| PDF ファイル | `https://www.hodatsushimizu.jp/material/files/group/13/{ファイル名}.pdf` |

### 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/7462.html` |
| 令和6年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/6614.html` |
| 令和5年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/5550.html` |
| 令和4年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/4845.html` |
| 令和3年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/4333.html` |
| 令和2年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1256.html` |
| 令和元年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1268.html` |
| 平成30年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1093.html` |
| 平成29年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1070.html` |
| 平成28年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1047.html` |
| 平成27年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1027.html` |
| 平成26年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/1009.html` |
| 平成25年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/995.html` |
| 平成24年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/986.html` |
| 平成23年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/977.html` |
| 平成22年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/971.html` |
| 平成21年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/969.html` |
| 平成20年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/964.html` |
| 平成19年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/962.html` |
| 平成18年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/958.html` |
| 平成17年 | `https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/955.html` |

---

## HTML 構造

### 年度一覧ページ

```html
<ul>
  <li><a href="/soshiki/gikaijimukyoku/2/7462.html">令和7年宝達志水町議会会議録</a></li>
  <li><a href="/soshiki/gikaijimukyoku/2/6614.html">令和6年宝達志水町議会会議録</a></li>
  ...
</ul>
```

- `<ul>/<li>` のシンプルなリスト構造
- ページネーションなし（全年度が単一ページに掲載）

### 年度別会議録ページ

各年度ページには「関連書類」セクションがあり、PDF へのリンクが列挙されている。

```html
<h2>関連書類</h2>
<p>
  <a href="//www.hodatsushimizu.jp/material/files/group/13/{ファイル名}.pdf">
    令和X年第N回定例会会議録（M月D日〜M月D日）(PDFファイル: XXX.XKB)
  </a>
</p>
```

- 各 PDF は `<p>` タグ内の `<a>` タグで提供される
- リンクテキストに会議名・開催日・ファイルサイズが含まれる
- ページネーションなし

---

## リンクテキストの形式

| 形式 | 例 |
| --- | --- |
| 定例会（単日） | `令和5年第1回定例会会議録（3月2日）` |
| 定例会（複数日） | `令和5年第1回定例会会議録（3月2日〜3月10日）` |
| 臨時会 | `令和5年第1回臨時会会議録（1月6日）` |
| 旧形式（令和6年） | `宝達志水町R6年3月定例会` |

- ファイルサイズが括弧内に付記される（例: `(PDFファイル: 209.8KB)`）

---

## PDF ファイル名のパターン

ファイル名に統一規則はなく、年度・担当者によって形式が異なる。

| パターン例 | 説明 |
| --- | --- |
| `20250130.pdf` | 西暦年月日 |
| `R73teirei.pdf` | 令和年度＋回数＋種別 |
| `R60517.pdf` | 令和年＋月日 |
| `05010601.pdf` | 和暦年＋月日 |
| `0000013637.pdf` | システム管理番号 |

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

年度一覧ページ `index.html` から各年度ページへのリンクを取得する。

- `<ul>` 内の `<li><a>` を Cheerio で抽出
- リンク href を絶対 URL に変換する（`//` で始まる場合は `https:` を付与）

### Step 2: 各年度ページから PDF リンクを収集

各年度ページの「関連書類」セクション配下の `<a>` タグを取得する。

```typescript
// 例: Cheerio でのリンク抽出
const links = $("a[href$='.pdf']").map((_, el) => ({
  url: "https:" + $(el).attr("href"),
  text: $(el).text().trim(),
})).get();
```

- `href` の末尾が `.pdf` であるリンクを対象とする
- `//www.hodatsushimizu.jp/material/files/group/13/` のパスが基本

### Step 3: メタ情報のパース

リンクテキストから会議名・開催日を抽出する。

#### パース用正規表現（案）

```typescript
// 会議名の抽出（標準形式）
// 例: "令和5年第1回定例会会議録（3月2日〜3月10日）(PDFファイル: 722.6KB)"
const titlePattern = /^(.+?会議録)/;

// 開催日の抽出
const datePattern = /（((?:令和|平成)?\d+年)?(\d+月\d+日(?:[〜～]\d+月\d+日)?)）/;

// 会議種別の抽出
const sessionPattern = /第(\d+)回(定例会|臨時会)/;
```

---

## 注意事項

- 会議録検索システムは存在せず、全文検索には対応していない
- PDF のみの提供のため、テキスト抽出には PDF パーサーが必要
- PDF ファイル名に統一規則がないため、URL からメタ情報を取得することは困難。リンクテキストを主要な情報源とする
- 年度によってリンクテキストの形式が異なる（例: 令和6年は `宝達志水町R6年3月定例会` 形式）
- 差分更新の基準として、年度別ページ URL の追加を監視する方法が有効

---

## 推奨アプローチ

1. **年度一覧ページを起点**: `index.html` から全年度ページ URL を取得し、各年度ページをクロール
2. **PDF リンクの網羅的収集**: 各年度ページで `href$='.pdf'` のリンクを全件取得
3. **リンクテキストからメタ情報抽出**: 会議名・開催日はリンクテキストから正規表現でパース
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 年度一覧ページを定期チェックし、新年度ページの追加を検出する
