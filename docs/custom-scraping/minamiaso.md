# 南阿蘇村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.minamiaso.lg.jp/
- 分類: 村公式サイト内に年度別で掲載（外部の専用検索システムは使用していない）
- 文字コード: UTF-8
- 特記: 会議録は年度別の中間一覧ページを経由して個別 PDF へアクセスする 2 段階構造

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.vill.minamiaso.lg.jp/gikai/list00354.html` |
| 会議録メイン一覧 | `https://www.vill.minamiaso.lg.jp/gikai/list00576.html` |
| 年度別会議録一覧 | `https://www.vill.minamiaso.lg.jp/gikai/list{XXXXX}.html` |
| 会議録詳細ページ | `https://www.vill.minamiaso.lg.jp/gikai/kiji{XXXXXXX}/index.html` |
| PDF ファイル | `https://www.vill.minamiaso.lg.jp/gikai/kiji{XXXXXXX}/{ランダムファイル名}.pdf` |

---

## 年度別一覧ページ

各年度に対応する一覧ページの URL は以下の通り（現時点で確認済み）:

| 年度 | URL |
| --- | --- |
| 令和8年（2026年） | `https://www.vill.minamiaso.lg.jp/gikai/list00599.html` |
| 令和7年（2025年） | `https://www.vill.minamiaso.lg.jp/gikai/list00595.html` |
| 令和6年（2024年） | `https://www.vill.minamiaso.lg.jp/gikai/list00579.html` |
| 令和5年（2023年） | `https://www.vill.minamiaso.lg.jp/gikai/list00578.html` |

令和4年以前は会議録ページ（`list00576.html`）のサイドメニュー等から各年度ページへリンクされている。

---

## ページ構造

### 年度別一覧ページ

年度ごとに個別の HTML ページが存在し、その年の会議録が一覧表示される。例として令和6年の一覧（`list00579.html`）には以下が掲載されている:

- 令和6年第4回（12月）定例会会議録
- 令和6年第3回（9月）定例会会議録
- 令和6年第2回（7月）臨時会会議録
- 令和6年第2回（6月）定例会会議録
- 令和6年第1回（3月）定例会会議録
- 令和6年第1回（1月）臨時会議録

各エントリは `kiji{番号}/index.html` 形式の詳細ページへのリンクとなっている。

### 会議録詳細ページ

`kiji{番号}/index.html` は会議録の個別ページ。ページ内に PDF ファイルへのリンクが 1 件含まれる。

PDF URL の例:
```
https://www.vill.minamiaso.lg.jp/gikai/kiji0033811/3_3811_8978_up_mp6srzku.pdf
```

PDF ファイル名はランダムなハッシュ文字列を含むため、**ファイル名を推測・構築することはできない**。一覧ページおよび詳細ページの `<a href>` から直接収集する必要がある。

---

## 会議録の提供形式

- **PDF のみ**: 会議録本文の HTML 掲載はなく、PDF ダウンロードが唯一の取得方法
- 1 会議 = 1 PDF ファイル（本会議のみ、委員会別は掲載なし）
- ファイルサイズは数百 KB 程度（例: 令和6年第4回定例会は 565.6 KB）

---

## 会議種別

| 種別 | 備考 |
| --- | --- |
| 定例会 | 年複数回（3月・6月・9月・12月が標準） |
| 臨時会 | 年複数回（年によって異なる） |

委員会別の会議録は掲載されていない。すべて本会議（定例会・臨時会）のみ。

---

## 掲載年度範囲

令和3年（2021年）以降が確認されている。令和4年以前は会議録ページ（`list00576.html`）内のサイドメニューに年度別リンクが存在する。

---

## スクレイピング戦略

### Step 1: 年度別一覧ページ URL の収集

会議録メイン一覧ページ（`list00576.html`）から全年度の一覧ページ URL を収集する。

- サイドメニューまたはメインコンテンツに各年度ページへのリンクが含まれる
- 新年度が追加されると新たなリスト URL が追加されるため、定期的に更新確認が必要

### Step 2: 会議録詳細ページ URL の収集

各年度一覧ページを取得し、`kiji{番号}/index.html` 形式のリンクを全件抽出する。

```typescript
// Cheerio での収集例
const kijiLinks = $('a[href*="/kiji"]')
  .map((_, el) => {
    const href = $(el).attr('href')!;
    return new URL(href, 'https://www.vill.minamiaso.lg.jp/').toString();
  })
  .toArray()
  .filter(url => url.includes('/index.html'));
```

### Step 3: PDF URL の収集

各詳細ページを取得し、`.pdf` リンクを抽出する。

```typescript
// Cheerio での収集例
const pdfUrl = $('a[href$=".pdf"]').attr('href');
if (pdfUrl) {
  const absoluteUrl = new URL(pdfUrl, 'https://www.vill.minamiaso.lg.jp/').toString();
}
```

### Step 4: PDF の取得・テキスト抽出

PDF ファイルを取得し、テキスト抽出ツール（pdf-parse 等）でテキスト化する。

---

## メタ情報の取得

**詳細ページから取得できる情報:**

- 会議名: ページタイトルまたは `<h1>` 等の見出しテキスト（例: `令和6年第4回（12月）定例会会議録`）
- 更新日: ページ内の更新日表示

**会議名からのパース（案）:**

```typescript
// ページタイトルから年度・回次・種別を抽出
const sessionPattern = /(?:令和|平成)(\d+)年第(\d+)回（(.+?)）(定例会|臨時会)/;
// 例: "令和6年第4回（12月）定例会会議録"
//   → era="令和", year=6, count=4, month="12月", type="定例会"
```

---

## 注意事項

- **PDF ファイル名は予測不可**: ファイル名にランダムなハッシュ値が含まれるため、必ず HTML のリンクから URL を収集する
- **2 段階のクロール**: 年度一覧ページ → 詳細ページ → PDF と 2 ステップの取得が必要
- **新年度対応**: 毎年新しい年度の一覧ページが追加されるため、メイン一覧ページの定期確認が必要
- **会議録未掲載**: 会期開催後しばらくして掲載されるため、直近の会議は未掲載の場合がある

---

## 推奨アプローチ

1. **メイン一覧から年度 URL を収集**: `list00576.html` を取得し、全年度の一覧ページ URL を収集する
2. **年度ごとに詳細 URL を収集**: 各年度ページから `kiji{番号}/index.html` の URL を全件収集する
3. **詳細ページから PDF URL を取得**: 各詳細ページで `.pdf` リンクを抽出する
4. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機を設ける
5. **差分更新**: 取得済みの `kiji` 番号リストと比較し、新規のみを処理する
