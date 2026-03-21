# あさぎり町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.asagiri.lg.jp/list00300.html
- 分類: 町公式サイト（独自 CMS）で PDF を公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF のみ提供。HTML テキスト版なし。JavaScript（jQuery / autopager2）による「もっと見る」形式の遅延読込みで全 107 件を表示。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧 | `https://www.town.asagiri.lg.jp/list00300.html` |
| 追加ページ読み込み（AJAX） | `https://www.town.asagiri.lg.jp/dynamic/hpkiji/pub/hpkijilistpagerhandler.ashx?c_id=3&class_id=300&class_set_id=1&pg={ページ番号}&kbn=kijilist&top_id=0` |
| 会議録詳細ページ | `https://www.town.asagiri.lg.jp/kiji{5桁番号}/index.html` |
| PDF ファイル | `https://www.town.asagiri.lg.jp/kiji{5桁番号}/3_{4桁番号}_up_{ランダム文字列}.pdf` |

### kiji 番号の例

| kiji 番号 | 会議名 | PDF ファイル名 |
| --- | --- | --- |
| `0035107` | 令和7年度 第7回会議録 | `3_5107_up_citq3qds.pdf` |
| `0034955` | 令和7年度 第4回（9月定例日）会議録 | `3_4955_up_xbaqqeil.pdf` |
| `0034804` | 令和7年度 第1回（6月定例日）会議録 | `3_4804_up_z22ku07i.pdf` |

- PDF ファイル名の `{ランダム文字列}` 部分は規則性がなく、詳細ページの HTML から取得する必要がある

---

## ページ構造

### 一覧ページ（list00300.html）

- 会議録がリスト形式で表示される
- 各エントリは更新日付（`YYYY年M月D日更新`）とリンク付きタイトルで構成
- 初期表示件数は不明（一部）で、「もっと見る」ボタンで段階的に追加読み込み
- 全 107 件（2026年3月時点）

```html
<!-- エントリの例 -->
<li>
  <span class="date">2026年3月16日更新</span>
  <a href="/kiji0035107/index.html">令和7年度 第7回あさぎり町議会会議会議録</a>
</li>
```

### 詳細ページ（kiji{番号}/index.html）

- 会議名、開催日、更新日、PDF ダウンロードリンクを掲載
- 「検索システムには対応しておりませんので、会議日程及び目次を参考にご覧ください」との注記あり
- HTML テキスト版は存在しない

---

## 掲載年度範囲

令和4年度（2022年度）〜 令和7年度（2025年度）

| 年度 | 確認された会議数（例） |
| --- | --- |
| 令和7年度 | 7件以上 |
| 令和6年度 | 10件以上 |
| 令和5年度以前 | 複数件（全107件のうち残り） |

---

## AJAX エンドポイント

「もっと見る」ボタンは `hpkijilistpagerhandler.ashx` を呼び出す。

| パラメータ | 値 | 説明 |
| --- | --- | --- |
| `c_id` | `3` | サイト内カテゴリ ID |
| `class_id` | `300` | 分類 ID（会議録カテゴリ） |
| `class_set_id` | `1` | 分類セット ID |
| `pg` | `1` 以上の整数 | ページ番号 |
| `kbn` | `kijilist` | 記事リスト種別 |
| `top_id` | `0` | 固定値 |

---

## スクレイピング戦略

### Step 1: 全会議録詳細ページ URL の収集

`list00300.html` を取得し、`/kiji{番号}/index.html` 形式のリンクをすべて抽出する。「もっと見る」ボタンで遅延読込みされる分は AJAX エンドポイントを `pg` を増加させながら順次取得する。

**方法 A（推奨）: AJAX エンドポイントを直接叩く**

```typescript
// pg=1 から始めて、レスポンスが空になるまでインクリメント
const allLinks: string[] = [];
for (let pg = 1; ; pg++) {
  const url = `https://www.town.asagiri.lg.jp/dynamic/hpkiji/pub/hpkijilistpagerhandler.ashx?c_id=3&class_id=300&class_set_id=1&pg=${pg}&kbn=kijilist&top_id=0`;
  const html = await fetch(url).then(r => r.text());
  const links = parseKijiLinks(html); // /kiji\d+/index.html を抽出
  if (links.length === 0) break;
  allLinks.push(...links);
}
```

**方法 B: Playwright / Puppeteer でボタンクリックを自動化**

JavaScript を実行できるブラウザ環境を使い、「もっと見る」ボタンをすべてのエントリが表示されるまでクリックし続ける。

```typescript
// Playwright 例
await page.goto('https://www.town.asagiri.lg.jp/list00300.html');
while (await page.locator('.more-button').isVisible()) {
  await page.locator('.more-button').click();
  await page.waitForTimeout(1000);
}
const links = await page.locator('a[href*="/kiji"]').all();
```

### Step 2: PDF URL の収集

各詳細ページ（`kiji{番号}/index.html`）を取得し、`.pdf` へのリンクを抽出する。

```typescript
// Cheerio での収集例
const html = await fetch(`https://www.town.asagiri.lg.jp/kiji${kijiId}/index.html`).then(r => r.text());
const $ = cheerio.load(html);
const pdfUrl = $('a[href$=".pdf"]').attr('href');
// 相対パスの場合は絶対 URL に変換
const absolutePdfUrl = new URL(pdfUrl!, 'https://www.town.asagiri.lg.jp/').toString();
```

- PDF ファイル名のランダム部分（`up_xxxxxxxx`）は予測不可能なため、必ず HTML から取得する

### Step 3: 各 PDF を取得・テキスト抽出

PDF を取得し、テキスト抽出ツール（`pdf-parse` 等）でテキスト化する。

- ファイルサイズは 1 MB 〜 10 MB 程度（例: 9月定例日の会議録は 9.53 MB）
- PDF には会議録の全文（発言者・発言内容）が含まれる
- 構造化テキストの品質は PDF の作成方法による（スキャン PDF の場合は OCR が必要）

### Step 4: メタ情報の取得

**詳細ページから取得できる情報:**

- 会議名: ページタイトルまたは `<h1>` テキスト（例: `令和7年度 第7回あさぎり町議会会議会議録`）
- 開催日: ページ本文（例: `令和８年１月１５日（木曜日）`）
- 更新日: ページ内の更新日表示

**タイトルの正規表現（案）:**

```typescript
// 会議タイトルのパース
const titlePattern = /(?:令和|平成)(\d+)年度\s+第(\d+)回あさぎり町議会会議(?:（(.+?)）)?会議録/;
// 例: "令和7年度 第4回あさぎり町議会会議（9月定例日）会議録"
//   → year="7", count="4", session="9月定例日"

// 開催日のパース
const datePattern = /(?:令和|平成|昭和)(\d+)年(\d+)月(\d+)日/;
```

---

## 注意事項

- **PDF のみ**: HTML テキスト版は提供されていない。テキスト抽出は必ず PDF から行う
- **PDF ファイル名の予測不可**: `up_xxxxxxxx` のランダム文字列があるため、詳細ページを経由して PDF URL を取得する必要がある
- **遅延読込み**: 一覧ページは JavaScript による遅延読込みのため、`list00300.html` の初期 HTML だけでは全件取得できない。AJAX エンドポイントを直接叩くか、ブラウザ自動化を使用する
- **スキャン PDF の可能性**: 古い年度の会議録はスキャン PDF の場合があり、`pdf-parse` で抽出できないテキストが含まれる可能性がある

---

## 推奨アプローチ

1. **AJAX エンドポイントを直接叩く**: `hpkijilistpagerhandler.ashx?pg={N}` を `pg=1` から順に空レスポンスが返るまで取得し、詳細ページ URL を収集する
2. **詳細ページ経由で PDF URL を取得**: kiji 番号から PDF URL は推測できないため、各詳細ページを取得して PDF リンクを抽出する
3. **差分更新**: 詳細ページの更新日（`YYYY年M月D日更新`）を記録し、前回取得時より新しいエントリのみを対象にした差分更新が可能
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **PDF テキスト抽出の確認**: `pdf-parse` での抽出が失敗または空になる場合はスキャン PDF として扱い、OCR ツール（`tesseract.js` 等）にフォールバックする
