# 西予市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/index.html
- 分類: 公式サイト内 PDF 公開（独自 CMS、検索機能なし）
- 文字コード: UTF-8
- 特記: 検索機能はなく、年度別・会議種別ページから PDF に直接アクセスする構造

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/index.html` |
| 本会議トップ | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/index.html` |
| 本会議（年度別） | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/honkaigi/{id}.html` |
| 委員会・全員協議会トップ | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/index.html` |
| 常任委員会トップ | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/joniniinkai/index.html` |
| 常任委員会（委員会別） | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/joniniinkai/{id}.html` |
| 特別委員会トップ | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/tokubetsuiinkai/index.html` |
| 特別委員会（委員会別） | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/tokubetsuiinkai/{id}.html` |
| 全員協議会トップ | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/zeninkyougikai/index.html` |
| 全員協議会（一覧） | `https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/iinkai/zeninkyougikai/{id}.html` |
| PDF ファイル | `https://www.city.seiyo.ehime.jp/material/files/group/34/{ファイル名}.pdf` |

---

## 会議種別と対応ページ

### 本会議

`honkaigi/index.html` に年度別リンクが列挙される。

| 年度 | URL |
| --- | --- |
| 令和6年 | `honkaigi/17007.html` |
| 令和5年 | `honkaigi/14030.html` |
| 令和4年 | `honkaigi/11336.html` |
| 令和3年 | `honkaigi/9246.html` |
| 令和2年 | `honkaigi/7791.html` |
| 平成31年・令和元年 | `honkaigi/6888.html` |
| 平成30年 | `honkaigi/3135.html` |
| 平成29年 | `honkaigi/3134.html` |
| 平成28年以前（平成16年〜） | `honkaigi/3133.html` |

### 常任委員会

`joniniinkai/index.html` に委員会別リンクが列挙される（3委員会）。

| 委員会名 | URL |
| --- | --- |
| 総務常任委員会 | `joniniinkai/3151.html` |
| 厚生常任委員会 | `joniniinkai/3152.html` |
| 産業建設常任委員会 | `joniniinkai/3153.html` |

各委員会ページは年度ごとに `<h3>` 見出しで区切られ、PDF リンクが列挙される。

### 特別委員会

`tokubetsuiinkai/index.html` に委員会別リンクが列挙される（テーマ・期間ごとに個別ページ）。

| 委員会名 | URL |
| --- | --- |
| 西予市消防体制検討特別委員会 | `tokubetsuiinkai/9958.html` |
| 西予市決算審査特別委員会 | `tokubetsuiinkai/9117.html` |
| 地域医療と西予市立病院等の在り方調査特別委員会 | `tokubetsuiinkai/15645.html` |
| 地域医療と西予市立病院等の在り方調査特別委員会（第二期） | `tokubetsuiinkai/17094.html` |
| 西予市立病院等の指定管理者制度導入に関する特別委員会 | `tokubetsuiinkai/17742.html` |
| 西予市議会のあり方に関する特別委員会 | `tokubetsuiinkai/17852.html` |
| 西予市の財政に関する特別委員会 | `tokubetsuiinkai/17875.html` |

### 全員協議会

`zeninkyougikai/index.html` → `zeninkyougikai/16621.html` に PDF リンクが列挙される。

---

## HTML 構造

### 年度別一覧ページ（本会議）

```html
<h2>本会議</h2>
<ul>
  <li><a href=".../honkaigi/17007.html">令和6年</a></li>
  <li><a href=".../honkaigi/14030.html">令和5年</a></li>
  <!-- 以降同様 -->
</ul>
```

### PDF リンクページ（各年度・各委員会）

```html
<h2>本会議 令和6年</h2>
<p>
  <a href="//www.city.seiyo.ehime.jp/material/files/group/34/teireikaidainikai.pdf">
    【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)
  </a>
</p>
<p>
  <a href="//www.city.seiyo.ehime.jp/material/files/group/34/0601rinjikai.pdf">
    【会議録】令和6年第1回臨時会（5月17日）(PDFファイル: 623.5KB)
  </a>
</p>
```

委員会ページは年度ごとに `<h3>` 見出し（例: `<h3>令和6年</h3>`）で区切られ、配下に同様の `<p><a>` 形式で PDF リンクが列挙される。

---

## PDF ファイル命名規則

ファイル名に統一した命名規則はなく、アップロード時のファイル名がそのまま使用される。以下は観測されたパターン例:

| 種別 | ファイル名例 |
| --- | --- |
| 本会議 定例会 | `teireikaidainikai.pdf`, `0601teireikai.pdf` |
| 本会議 臨時会 | `0722rinnzikai2.pdf`, `0601rinjikai.pdf` |
| 総務常任委員会 | `0702soumu0619.pdf`, `R6soumu1213.pdf` |
| 厚生常任委員会 | `R61213kousei.pdf`, `050913kouseiiinkai.pdf` |
| 全員協議会 | `060517zenkyou.pdf` |
| 平成年代 | `kaigiroku_H28_04teirei.pdf`, `sai_H17_teirei1.pdf` |

共通点: 全 PDF は `/material/files/group/34/` 以下に格納される。

---

## スクレイピング戦略

### Step 1: 対象ページ URL の収集

以下のインデックスページから PDF リンクを含む末端ページの URL を収集する。

1. **本会議**: `honkaigi/index.html` を取得し、年度別ページの `<a href>` を全件抽出（固定 9 件）
2. **常任委員会**: `joniniinkai/index.html` を取得し、委員会別ページの `<a href>` を全件抽出（固定 3 件）
3. **特別委員会**: `tokubetsuiinkai/index.html` を取得し、委員会別ページの `<a href>` を全件抽出（7 件、今後追加可能性あり）
4. **全員協議会**: `zeninkyougikai/index.html` を取得し、一覧ページの `<a href>` を抽出

### Step 2: 各ページから PDF リンクの抽出

Step 1 で収集した各ページを取得し、`/material/files/group/34/` を含む `<a href>` 要素を抽出する。

```typescript
// PDFリンクの抽出（Cheerio使用例）
const pdfLinks = $("a[href*='/material/files/group/34/']")
  .map((_, el) => ({
    url: "https:" + $(el).attr("href"),
    text: $(el).text().trim(),
  }))
  .get();
```

### Step 3: リンクテキストからメタ情報のパース

リンクテキストは `【会議録】令和6年第2回定例会（6月10日～6月27日）` 形式。

```typescript
// 会議名と日付の抽出
const titlePattern = /【会議録】(.+?)（(.+?)）/;
// 例: titlePattern.exec("【会議録】令和6年第2回定例会（6月10日～6月27日）")
// → [_, "令和6年第2回定例会", "6月10日～6月27日"]

// 開催日の抽出（単日）
const singleDatePattern = /（(\d+)月(\d+)日）/;

// 会期の抽出（複数日）
const periodPattern = /（(\d+)月(\d+)日～(\d+)月(\d+)日）/;

// 元号・年の抽出
const eraPattern = /(?:令和|平成)(\d+)年/;
```

### Step 4: PDF のダウンロードとテキスト抽出

- PDF は直接ダウンロード可能（認証不要）
- テキスト抽出には `pdf-parse` 等のライブラリを使用
- 会議録 PDF は 100KB〜6MB 程度のサイズ

---

## ページネーション

**なし。** 全ページで一覧はシングルページに収まっており、ページ送り機能は存在しない。

---

## 注意事項

- インデックスページ (`index.html`) は CMS の動的コンテンツ読み込み (`cmsDynExecuteGetPageList`) を使用しているが、年度別・委員会別の末端ページは静的 HTML であり、Cheerio でのパースが可能
- PDF ファイル名に統一規則がないため、URL からの情報抽出はリンクテキストに依存する
- 全員協議会は「行政案件のみ公開（令和6年5月16日から）」との記載あり。一部の会議は非公開の可能性がある
- 特別委員会は都度新設されるため、`tokubetsuiinkai/index.html` の定期的な確認が必要
- 本会議の平成28年以前のデータは1ページにまとめられており（`honkaigi/3133.html`）、平成16年〜平成28年分が含まれる

---

## 推奨アプローチ

1. **ハードコードした起点 URL**: インデックスページは固定のため、`honkaigi/index.html`・`joniniinkai/index.html`・`tokubetsuiinkai/index.html`・`zeninkyougikai/index.html` の 4 ページを起点とする
2. **2 段階クロール**: 起点ページで末端ページ URL を収集 → 末端ページで PDF リンクを収集
3. **差分更新**: PDF URL をキーとして既取得分を管理し、新規 URL のみを処理する
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **特別委員会の追加検知**: `tokubetsuiinkai/index.html` を定期クロールし、新たな委員会ページを検出する
