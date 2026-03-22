# 東洋町議会 カスタムスクレイピング方針

## 概要

- サイト: http://www.town.toyo.kochi.jp/gikai-toyo/kaigiroku.html
- 分類: 独自 CMS による静的 HTML + PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 文書形式: PDF（会議録本文はすべて PDF ファイルで提供）
- 特記: Google Analytics（G-XLVD7Y0J7S）使用

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `http://www.town.toyo.kochi.jp/gikai-toyo/kaigiroku.html` |
| 年度別会議録一覧 | `http://www.town.toyo.kochi.jp/gikai-toyo/gikai{ページID}.html` |
| PDF ファイル | `http://www.town.toyo.kochi.jp/gikai-toyo/pbfile/m{ページID}/{ファイル名}.pdf` |

---

## サイト構造

### トップページ（kaigiroku.html）

年度別リンクの一覧を `<ul>` で提供。各 `<li>` 内の `<a>` タグで年度別ページへ遷移する。

```html
<li><a href="gikai263.html">令和7年</a></li>
<li><a href="gikai246.html">令和6年</a></li>
<!-- ... -->
<li><a href="gikai007.html">平成25年</a></li>
```

ページ ID と年度の対応:

| ページ ID | 年度 |
| --- | --- |
| `gikai263` | 令和7年 |
| `gikai246` | 令和6年 |
| `gikai225` | 令和5年 |
| `gikai206` | 令和4年 |
| `gikai178` | 令和3年 |
| `gikai162` | 令和2年 |
| `gikai131` | 平成31年/令和元年 |
| `gikai087` | 平成30年 |
| `gikai088` | 平成29年 |
| `gikai089` | 平成28年 |
| `gikai090` | 平成27年 |
| `gikai091` | 平成26年 |
| `gikai007` | 平成25年 |

※ `gikai128`（高知県知事審決結果）、`gikai086`（懲罰結果）は特殊ページのため、通常の会議録スクレイピング対象外。

### 年度別ページ（gikai{ID}.html）

各年度ページは `<div id="pb_main">` 内に以下の構造を持つ:

- `<h3>`: 定例会・臨時会の見出し（例: `令和７年第１回定例会　会議録`）
- `<p class="pb_file">`: PDF リンク + ファイルサイズ

```html
<h3>令和７年第１回定例会　会議録</h3>
<p class="pb_file"><a href="pbfile/m000263/pbf20250610133721_DBhHU3xbElHe.pdf" target="_blank">R7.3.5令和7年第1回定例会(1日目)　会議録</a>（1.55MB）</p>
<p class="pb_file"><a href="pbfile/m000263/pbf20250610134457_eLA3oAUAAMdO.pdf" target="_blank">R7.3.12令和7年第1回定例会(2日目)　会議録</a>（4.5MB）</p>
```

### PDF ファイル名パターン

新しい年度と古い年度でファイル名の形式が異なる:

- **新形式**（令和以降）: `pbf{タイムスタンプ}_{ランダム文字列}.pdf`
  - 例: `pbf20250610133721_DBhHU3xbElHe.pdf`
- **旧形式**（平成）: `{和暦日付}{会議種別}.pdf`
  - 例: `h251205teirei-1.pdf`、`h250820rinnji.pdf`

---

## 会議の種類

| 種別 | リンクテキスト例 |
| --- | --- |
| 定例会 | `令和７年第１回定例会　会議録` |
| 臨時会 | `令和７年第１回臨時会　会議録` |

定例会は通常複数日にわたり、日目ごとに個別の PDF が提供される（例: `(1日目)`、`(2日目)`）。
臨時会は通常1日のみ。

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `kaigiroku.html` から年度別ページへのリンクを収集する。

- `<div id="pb_main">` 内の `<ul>` → `<li>` → `<a>` タグの `href` を取得
- 特殊ページ（懲罰結果、審決結果等）はリンクテキストで判別して除外

**収集方法:**

```typescript
// トップページから年度リンクを抽出
const yearLinks = $("div#pb_main ul li a")
  .map((_, el) => ({
    text: $(el).text(),
    href: $(el).attr("href"),
  }))
  .get()
  .filter((link) => /^(令和|平成)\d+年/.test(link.text));
```

### Step 2: PDF リンクの収集

各年度ページから PDF ファイルへのリンクを収集する。

- `<p class="pb_file">` 内の `<a>` タグから `href` とリンクテキストを取得
- `<h3>` タグから定例会/臨時会の情報を取得

**収集方法:**

```typescript
// 年度ページから PDF リンクを抽出
const pdfLinks: { session: string; text: string; href: string }[] = [];
let currentSession = "";

$("div#pb_main > div")
  .children()
  .each((_, el) => {
    if (el.tagName === "h3") {
      currentSession = $(el).text().trim();
    }
    if (el.tagName === "p" && $(el).hasClass("pb_file")) {
      const a = $(el).find("a");
      pdfLinks.push({
        session: currentSession,
        text: a.text().trim(),
        href: a.attr("href") ?? "",
      });
    }
  });
```

### Step 3: メタ情報の抽出

PDF リンクテキストから開催日と会議情報を抽出する。

リンクテキストのパターン:

- 新形式: `R7.3.5令和7年第1回定例会(1日目)　会議録`
- 旧形式: `平成25年12月5日会議録`

```typescript
// 新形式: R{和暦年}.{月}.{日}{会議名}
const newPattern = /^R(\d+)\.(\d+)\.(\d+)(.+?)(?:　| )会議録/;
// 例: R7.3.5令和7年第1回定例会(1日目) → year=7, month=3, day=5

// 旧形式: 平成{年}年{月}月{日}日会議録
const oldPattern = /^平成(\d+)年(\d+)月(\d+)日会議録/;
```

### Step 4: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）を使用してテキストを抽出
- 会議録の構造（発言者、発言内容等）をパースする

---

## 注意事項

- **全量が PDF**: 会議録はすべて PDF 形式で提供されるため、HTML パースではなく PDF テキスト抽出が必要
- **ページ ID は連番でない**: 年度別ページの ID（`gikai007`、`gikai086` 等）は連番ではなく、トップページのリンクから動的に取得する必要がある
- **ファイルサイズ**: PDF のサイズは 100KB 〜 4.5MB と幅がある。大きなファイルは複数日分の議事を含む
- **SSL 証明書**: サイトが HTTP で提供されている（HTTPS ではない）
- **ページネーションなし**: 年度別ページにページネーションはなく、1ページに全会議の PDF リンクが掲載される

---

## 推奨アプローチ

1. **2段階クロール**: まずトップページから年度ページ URL を収集し、次に各年度ページから PDF リンクを収集する
2. **PDF テキスト抽出**: pdf-parse 等のライブラリで PDF からテキストを抽出し、発言者・発言内容をパースする
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: トップページの年度リンクを監視し、新しい年度ページが追加された場合のみクロールを実行する。既存年度ページについても PDF リンク数の変化で差分を検知できる
