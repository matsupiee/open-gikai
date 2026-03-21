# 小国町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kumamoto-oguni.lg.jp/ogunitowngikai/gikai_kaigiroku
- 分類: 町公式サイト内で PDF 形式の会議録を直接公開（外部の会議録検索システムは使用していない）
- 文字コード: UTF-8
- 対象期間: 平成27年（2015年）〜現在

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧トップ | `https://www.town.kumamoto-oguni.lg.jp/ogunitowngikai/gikai_kaigiroku` |
| 会議録一覧（詳細） | `https://www.town.kumamoto-oguni.lg.jp/ogunitowngikai/gikai_kaigiroku/23582` |
| PDF ファイル | `https://www.town.kumamoto-oguni.lg.jp/resource.php?e={ハッシュ値}` |

- 一覧トップページには `23582` への単一リンクのみが存在し、全 PDF リンクは `/23582` ページに集約されている
- PDF の URL はハッシュ値ベースで固定されており、推測・連番ではない

---

## ページ構造

会議録一覧ページ（`/23582`）は以下の構造を持つ:

```html
<h1>議会会議録</h1>

<h3>令和８年</h3>
<ul>
  <li><a href="/resource.php?e={ハッシュ}">令和8年第1回臨時会 (261KB)</a></li>
  ...
</ul>

<h3>令和７年</h3>
<ul>
  <li><a href="/resource.php?e={ハッシュ}">第4回定例会 (1,470KB)</a></li>
  ...
</ul>
```

- `<h3>` タグで年度が区切られる
- `<ul><li><a>` の構造で各 PDF へのリンクが並ぶ
- リンクテキストに会議名とファイルサイズ（KB）が含まれる

---

## 会議録の種別

以下の種別が確認されている:

| 種別 | 例 |
| --- | --- |
| 定例会 | 第1回定例会、第2回定例会、第3回定例会、第4回定例会 |
| 臨時会 | 第1回臨時会〜第5回臨時会 |
| 常任委員会 | 総務文教福祉常任委員会、産業常任委員会 |
| 全員協議会 | 第N回全員協議会 |

- 複数の会議を1つの PDF にまとめて公開するケースがある（例: 「第3回定例会・第1回常任委員会」）

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

1. `https://www.town.kumamoto-oguni.lg.jp/ogunitowngikai/gikai_kaigiroku/23582` にアクセス
2. `<a href="/resource.php?e=...">` パターンにマッチするリンクをすべて抽出
3. 各リンクについて以下を取得:
   - PDF の URL（`https://www.town.kumamoto-oguni.lg.jp/resource.php?e={ハッシュ}`）
   - リンクテキスト（会議名・ファイルサイズ）
   - 直前の `<h3>` タグから年度情報

**Cheerio を使った抽出例:**

```typescript
const $ = cheerio.load(html);
const results: { year: string; title: string; url: string }[] = [];

let currentYear = "";
$("h3, ul li a[href^='/resource.php']").each((_, el) => {
  if (el.tagName === "h3") {
    currentYear = $(el).text().trim();
  } else {
    results.push({
      year: currentYear,
      title: $(el).text().trim(),
      url: `https://www.town.kumamoto-oguni.lg.jp${$(el).attr("href")}`,
    });
  }
});
```

### Step 2: PDF の取得とテキスト抽出

- 各リンクの PDF ファイルをダウンロードし、テキストを抽出する
- PDF テキスト抽出には `pdf-parse` 等のライブラリを使用する
- ファイルサイズは数百KB〜数MB程度（最大 7,657KB）

### Step 3: メタ情報のパース

リンクテキストから年度・会議名を解析する:

```typescript
// リンクテキスト例: "令和8年第1回臨時会 (261KB)"
// リンクテキスト例: "第4回定例会 (1,470KB)"（年度は h3 タグから取得）
const titlePattern = /^(.+?)\s*\(\d+KB\)$/;
const match = linkText.match(titlePattern);
const title = match ? match[1] : linkText;
```

---

## 注意事項

- PDF の URL はハッシュ値ベースのため、新規追加ファイルは一覧ページの再クロールで検出する必要がある
- 一覧ページ（`/23582`）のページ ID が将来変更される可能性は低いが、トップページ（`/gikai_kaigiroku`）から辿ることで安全に ID を解決できる
- 複数会議が1つの PDF にまとめられているケースがあるため、リンクテキストをそのまま会議名として扱う
- ページネーションは実質存在しない（全 PDF が単一ページに掲載）

---

## 推奨アプローチ

1. **単一ページからの全量取得**: 全 PDF リンクが1ページに集約されているため、`/23582` を1回クロールするだけで全 PDF の URL リストを取得できる
2. **差分更新**: 取得済みの PDF URL をハッシュ値で管理し、新規追加分のみダウンロードする
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **年度情報の補完**: `<h3>` タグの年度と各リンクのテキストを組み合わせてメタ情報を構成する
