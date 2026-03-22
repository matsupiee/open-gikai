# 麻績村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.omi.nagano.jp/omimura/gikai/gikaijimukyoku536.html
- 分類: 村公式サイトで PDF ファイルを直接ダウンロード提供（検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録は定例会・臨時会ごとに 1 つの PDF にまとめて掲載。年度・会議名別に整理されている。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議事録一覧 | `https://www.vill.omi.nagano.jp/omimura/gikai/gikaijimukyoku536.html` |
| PDF ファイル（令和5年以降） | `https://www.vill.omi.nagano.jp/files/gikaijimukyoku/{和暦年}年第{回}回定例会.pdf` |
| PDF ファイル（令和4年以前・一部） | `https://www.vill.omi.nagano.jp/files/gikaijimukyoku/20230216/{ファイル名}.pdf` |

### PDF URL のパターン

PDF の URL 命名規則は年度によって統一されていない。主なパターン:

| 年度 | URL パターン例 |
| --- | --- |
| 令和5年〜 | `/files/gikaijimukyoku/令和{N}年第{M}回定例会.pdf` |
| 令和4年（後半） | `/files/gikaijimukyoku/令和{N}年第{M}回定例会.pdf` |
| 令和4年（前半） | `/files/gikaijimukyoku/20230216/R4.{月}teireikai.pdf` |
| 令和2〜3年 | `/files/gikaijimukyoku/20230216/R{N}.{月}teireikai.pdf` |
| 平成31年 | `/files/gikaijimukyoku/20230216/H31.3teirei.pdf` 等（命名不統一） |
| 平成25〜30年 | `/files/gikaijimukyoku/20230216/H{YY}.{月}teirei.pdf` 等（命名不統一） |

**重要**: ファイル名の命名規則が統一されていないため、URL を推測して生成するのではなく、一覧ページの HTML から `<a>` タグの `href` 属性を直接抽出する必要がある。

---

## HTML 構造

### 一覧ページの構成

議事録一覧ページは以下の構造:

```html
<div class="c-entry-body">
  <p>下記関連ファイルをご覧ください。</p>
  <h2>令和7年議事録</h2>
  <ul class="c-list-horizontal">
    <li>
      <a href="/files/gikaijimukyoku/令和７年第１回定例会.pdf" target="_blank" rel="noopener">
        3月定例会　議事録 (1.5MB)
      </a>
    </li>
  </ul>
  <h2>令和6年議事録</h2>
  <ul class="c-list-horizontal">
    <li>
      <a href="/files/gikaijimukyoku/令和６年第４回定例会.pdf" target="_blank" rel="noopener">
        12月定例会　議事録 (1.2MB)
      </a>
    </li>
    <!-- ... -->
  </ul>
  <!-- 平成25年まで同様の構造が続く -->
</div>
```

### 抽出ポイント

- `div.c-entry-body` 内の `<h2>` が年度見出し（例: `令和7年議事録`）
- 各 `<h2>` の直後の `<ul>` 内に PDF リンクが含まれる
- `<a>` タグの `href` 属性から PDF の URL を取得
- リンクテキストから会議名を取得（例: `3月定例会　議事録 (1.5MB)`）

---

## 掲載範囲

- 最古: 平成25年（2013年）
- 最新: 令和7年（2025年）
- 会議種別: 定例会（3月・6月・9月・12月）、臨時会（不定期）
- ページネーション: なし（1 ページに全年度を掲載）

---

## スクレイピング戦略

### Step 1: PDF URL の収集

議事録一覧ページ `gikaijimukyoku536.html` から全 PDF リンクを抽出する。

**収集方法:**

1. 一覧ページの HTML を取得
2. `div.c-entry-body` 内の `<h2>` テキストから年度を特定
3. 各 `<ul class="c-list-horizontal">` 内の `<a>` タグから PDF の `href` とリンクテキストを抽出
4. リンクテキストから会議名（定例会/臨時会）と月を抽出

**抽出用の Cheerio セレクタ:**

```typescript
// 年度見出しの取得
const headings = $("div.c-entry-body h2");

// 各年度配下の PDF リンク取得
headings.each((_, h2) => {
  const yearText = $(h2).text(); // "令和7年議事録"
  const links = $(h2).nextUntil("h2", "ul").find("a");
  links.each((_, a) => {
    const href = $(a).attr("href"); // "/files/gikaijimukyoku/..."
    const text = $(a).text(); // "3月定例会　議事録 (1.5MB)"
  });
});
```

### Step 2: PDF のダウンロード

収集した URL から PDF をダウンロードする。

- ベース URL: `https://www.vill.omi.nagano.jp`
- `href` が相対パスの場合はベース URL を結合
- 一部のファイル名にスペースが含まれる（例: `R1dai4kaiteirei .pdf`）ため、URL エンコードに注意

### Step 3: PDF からのテキスト抽出

PDF からテキストを抽出し、会議録データとして保存する。

#### メタ情報の抽出

リンクテキストと年度見出しから以下を抽出:

- 年度: `<h2>` テキストから（例: `令和7年議事録` → `令和7年`）
- 会議名: リンクテキストから（例: `3月定例会　議事録` → `3月定例会`）
- 会議種別: `定例会` or `臨時会`

#### リンクテキストのパース

```typescript
// 年度の抽出
const yearPattern = /^((?:令和|平成)\d+)年議事録$/;
// 例: "令和7年議事録" → "令和7"

// 会議名の抽出
const sessionPattern = /^(\d+月(?:定例会|臨時会)|第\d+回(?:定例会|臨時会))[\s　]+議事録/;
// 例: "3月定例会　議事録 (1.5MB)" → "3月定例会"
// 例: "第1回臨時会　議事録 (215.9KB)" → "第1回臨時会"
```

---

## 注意事項

- PDF ファイルのサイズは 200KB〜2.5MB 程度。定例会は 1MB 前後、臨時会は 500KB 以下が多い
- ファイル名に全角文字（`令和７年第１回定例会.pdf`）や半角スペース（`R1dai4kaiteirei .pdf`）が含まれるケースがある
- `<ul class="c-list-horizontal">` がネストしている箇所がある（令和6年部分）ため、`find("a")` で再帰的に取得する
- 一覧ページは 1 ページ構成でページネーションなし

---

## 推奨アプローチ

1. **一覧ページから全量取得**: 1 ページに全年度が掲載されているため、1 回の HTML 取得で全 PDF リンクを収集可能
2. **PDF ダウンロード → テキスト抽出**: HTML ベースの会議録ではないため、PDF パーサー（pdf-parse 等）を使用してテキスト化する
3. **レート制限**: 自治体サイトのため、PDF ダウンロード間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 一覧ページの `<a>` タグ数を前回と比較し、新規追加分のみダウンロードする
5. **ファイル名のサニタイズ**: URL に全角文字やスペースが含まれるため、適切にエンコードして保存する
