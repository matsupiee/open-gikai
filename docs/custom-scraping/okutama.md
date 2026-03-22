# 奥多摩町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.html
- 分類: SMART CMS による年度別ページ + PDF/Word ファイル公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 年度別のページに PDF（近年）または Word（平成22〜25年頃）ファイルで会議録を掲載

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.html` |
| 年度別会議録ページ | `https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/{page_no}.html` |
| 年度一覧 JSON API | `https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.tree.json` |
| PDF ファイル | `https://www.town.okutama.tokyo.jp/material/files/group/11/{filename}.pdf` |
| Word ファイル（古い年度） | `https://www.town.okutama.tokyo.jp/material/files/group/11/{filename}.doc` |
| 一般質問（結果）ページ | `https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/1285.html` |

---

## 年度別ページ一覧

`index.tree.json` から動的に取得可能。現時点で以下の年度ページが存在する:

| 年度 | page_no | URL |
| --- | --- | --- |
| 令和7年 | 3406 | `/kaigiroku/3406.html` |
| 令和6年 | 3040 | `/kaigiroku/3040.html` |
| 令和5年 | 2760 | `/kaigiroku/2760.html` |
| 令和4年 | 2365 | `/kaigiroku/2365.html` |
| 令和3年 | 1274 | `/kaigiroku/1274.html` |
| 令和2年 | 1273 | `/kaigiroku/1273.html` |
| 平成31年 | 1276 | `/kaigiroku/1276.html` |
| 平成30年 | 1275 | `/kaigiroku/1275.html` |
| 平成29年 | 1278 | `/kaigiroku/1278.html` |
| 平成28年 | 1277 | `/kaigiroku/1277.html` |
| 平成27年 | 1280 | `/kaigiroku/1280.html` |
| 平成26年 | 1279 | `/kaigiroku/1279.html` |
| 平成25年 | 1282 | `/kaigiroku/1282.html` |
| 平成24年 | 1281 | `/kaigiroku/1281.html` |
| 平成23年 | 1284 | `/kaigiroku/1284.html` |
| 平成22年 | 1283 | `/kaigiroku/1283.html` |

---

## HTML 構造（年度別ページ）

各年度ページは以下の構造を持つ:

```html
<!-- 定例会セクション -->
<h2><span class="bg"><span class="bg2"><span class="bg3">第1回定例会</span></span></span></h2>
<h3><span class="bg"><span class="bg2"><span class="bg3">令和6年3月1日～3月15日</span></span></span></h3>

<!-- ファイルリンク（PDF の場合） -->
<p class="file-link-item">
  <a class="pdf" href="//www.town.okutama.tokyo.jp/material/files/group/11/{filename}.pdf">
    本会議1日目 (PDFファイル: 1.1MB)
  </a>
</p>

<!-- ファイルリンク（Word の場合、古い年度） -->
<p class="file-link-item">
  <a class="word" href="//www.town.okutama.tokyo.jp/material/files/group/11/{filename}.doc">
    本会議1日目 (Wordファイル: 342.5KB)
  </a>
</p>
```

### 会議種別

- **本会議**（1日目〜4日目）
- **予算特別委員会**（第1回定例会に付随、1〜3日目）
- **決算特別委員会**（第3回定例会に付随、1〜2日目）
- **連合審査会**（古い年度で出現）
- **臨時会**（不定期）

### リンクテキストのパターン

- `本会議1日目`
- `本会議3日目（一般質問）`
- `予算特別委員会1日目`
- `決算特別委員会2日目`
- `連合審査会`

### ファイル形式の変遷

| 期間 | ファイル形式 | CSS クラス |
| --- | --- | --- |
| 令和2年〜現在 | PDF | `a.pdf` |
| 平成22年〜平成31年頃 | Word (.doc) | `a.word` |

---

## スクレイピング戦略

### Step 1: 年度ページ URL の収集

`index.tree.json` API を使って全年度ページの URL を取得する。

```
GET https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.tree.json
```

- JSON 配列で各年度ページの `page_no`, `page_name`, `url` が返る
- `page_name` が「会議記録(一般質問(結果))」のエントリ（page_no: 1285）は除外する

### Step 2: 各年度ページからファイルリンクの収集

各年度ページの HTML をパースし、会議情報とファイル URL を抽出する。

**抽出対象:**

1. `<h2>` → 会議種別（例: 「第1回定例会」「第1回臨時会」）
2. `<h3>` → 会期（例: 「令和6年3月1日～3月15日」）
3. `<p class="file-link-item"> <a>` → ファイル URL とリンクテキスト

**パース用セレクタ:**

```typescript
// Cheerio による抽出
const sections = $("h2");
sections.each((_, h2) => {
  const meetingType = $(h2).text().trim(); // "第1回定例会"
  const h3 = $(h2).next("h3");
  const period = h3.text().trim(); // "令和6年3月1日～3月15日"

  // h3 の次の兄弟要素から file-link-item を収集
  let el = h3.next();
  while (el.length && !el.is("h2")) {
    if (el.is("p.file-link-item")) {
      const link = el.find("a");
      const url = link.attr("href"); // PDF or Word URL
      const text = link.text().trim(); // "本会議1日目 (PDFファイル: 1.1MB)"
    }
    el = el.next();
  }
});
```

### Step 3: PDF/Word ファイルのダウンロードとテキスト抽出

- PDF ファイル: PDF パーサー（pdf-parse 等）でテキストを抽出
- Word ファイル: mammoth 等で .doc をテキスト変換
- ファイル URL のプロトコルが `//` で始まるため、`https:` を付与する必要がある

### Step 4: メタ情報の抽出

リンクテキストと見出し情報からメタデータを構成する:

```typescript
// 会期の抽出
const periodPattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日[～〜](\d+)月(\d+)日/;

// リンクテキストから会議名と日次を抽出
const meetingPattern = /^(.+?)(\d+)日目/; // "本会議1日目" → type="本会議", day=1
const committeePattern = /^(.+?委員会)(\d+)日目/; // "予算特別委員会1日目"
const specialPattern = /（(一般質問)）/; // 一般質問の検出
```

---

## ページネーション

なし。各年度ページに当該年度の全会議録ファイルが一覧表示される。

---

## 注意事項

- SMART CMS を使用しており、年度一覧は JavaScript で動的に描画されるが、`index.tree.json` API で静的に取得可能
- ファイル URL はプロトコル相対（`//www.town.okutama.tokyo.jp/...`）で記載されている
- PDF ファイル名はローマ字表記の日本語で構成されており、規則性が低い（例: `honnkaigiitinitimereiwarokunennsanngatutuitati.pdf`）→ ファイル名からのメタ情報抽出は非推奨
- 古い年度（平成22〜25年頃）は Word 形式 (.doc) で提供されており、PDF とは別のパーサーが必要
- 一般質問（結果）ページ（page_no: 1285）は平成22〜25年分のみで、Word ファイルで提供

---

## 推奨アプローチ

1. **JSON API を活用**: `index.tree.json` で年度ページ一覧を動的に取得し、新年度追加時も自動対応
2. **HTML パースでファイルリンク収集**: `p.file-link-item a` セレクタで PDF/Word リンクを確実に抽出
3. **メタ情報は HTML の見出しから取得**: ファイル名ではなく `<h2>`（会議種別）と `<h3>`（会期）からメタデータを構成
4. **ファイル形式の分岐処理**: `a.pdf` と `a.word` の CSS クラスでファイル形式を判別し、適切なパーサーを使い分ける
5. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
6. **差分更新**: `index.tree.json` の `publish_datetime` を利用して、更新のあった年度ページのみを再クロールする
