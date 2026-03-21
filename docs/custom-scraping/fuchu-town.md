# 府中町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.fuchu.hiroshima.jp/site/assembly/list158.html
- 分類: 公式サイト上で年度別にページを分けて会議録を PDF で掲載（会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録は全て PDF ファイルで提供。目録（議事日程）と本文が別ファイルに分かれている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.fuchu.hiroshima.jp/site/assembly/list158.html` |
| 年度別一覧 | `https://www.town.fuchu.hiroshima.jp/site/assembly/list158-{id}.html` |
| 会議別詳細（PDF リンク一覧） | `https://www.town.fuchu.hiroshima.jp/site/assembly/{id}.html` |
| 会議録 PDF | `https://www.town.fuchu.hiroshima.jp/uploaded/attachment/{id}.pdf` |

### 年度別一覧ページの URL

| 年度 | URL パス |
| --- | --- |
| 令和8年 | `/site/assembly/list158-1652.html` |
| 令和7年 | `/site/assembly/list158-1604.html` |
| 令和6年 | `/site/assembly/list158-1557.html` |
| 令和5年 | `/site/assembly/list158-1502.html` |
| 令和4年 | `/site/assembly/list158-1438.html` |
| 令和3年 | `/site/assembly/list158-1348.html` |
| 令和2年 | `/site/assembly/list158-1236.html` |
| 令和元年・平成31年 | `/site/assembly/list158-1108.html` |
| 平成30年 | `/site/assembly/list158-658.html` |
| 平成29年 | `/site/assembly/list158-363.html` |
| 平成28年 | `/site/assembly/list158-365.html` |
| 平成27年 | `/site/assembly/list158-366.html` |
| 平成26年 | `/site/assembly/list158-367.html` |
| 平成25年 | `/site/assembly/list158-368.html` |
| 平成24年 | `/site/assembly/list158-369.html` |

---

## サイト構造

3 階層の構造になっている:

1. **会議録トップページ** (`list158.html`): 令和8年〜平成24年の年度別リンク一覧
2. **年度別一覧ページ** (`list158-{id}.html`): その年度の定例会・臨時会へのリンク一覧
3. **会議別詳細ページ** (`{id}.html`): 日程ごとの目録 PDF・本文 PDF へのリンク一覧

---

## 会議の種類

- **定例会**: 年4〜5回開催（第1回〜第5回）
- **臨時会**: 不定期開催

---

## PDF ファイル構成

各会議の詳細ページでは、日程ごとに以下の 2 種類の PDF が掲載される:

| 種類 | 内容 | サイズ目安 |
| --- | --- | --- |
| 目録（第N号） | 議事日程、出席議員一覧など | 92〜161KB |
| 本文（第N号） | 会議録の発言内容全文 | 628〜821KB |

### PDF リンクの HTML 構造

```html
<ul>
  <li><a href="/uploaded/attachment/31535.pdf">目録（第1号） [PDFファイル／161KB]</a></li>
  <li><a href="/uploaded/attachment/31536.pdf">本文（第1号） [PDFファイル／821KB]</a></li>
  ...
</ul>
```

---

## スクレイピング戦略

### Step 1: 全 PDF URL の収集

1. 会議録トップページ (`list158.html`) から年度別一覧ページの URL を全て取得
2. 各年度別一覧ページから会議別詳細ページの URL を全て取得
3. 各会議別詳細ページから本文 PDF の URL を全て取得（目録 PDF はスキップ可）

**収集方法:**

- 各階層のページを Cheerio でパースし、`<a>` タグの `href` を抽出
- 年度別一覧: `/site/assembly/{数字}.html` パターンのリンクを収集
- 会議別詳細: `/uploaded/attachment/{数字}.pdf` パターンのリンクを収集
- 本文 PDF のみ取得する場合はリンクテキストに「本文」を含むものをフィルタ

### Step 2: PDF のダウンロードとテキスト抽出

- PDF を取得し、`pdfplumber` や `pdf-parse` 等のライブラリでテキストを抽出
- PDF は構造化 PDF（MarkInfo 対応）のため、テキスト抽出は比較的容易

### Step 3: 会議録のパース

#### メタ情報

PDF 冒頭から以下を抽出:

```
令和７年第５回府中町議会定例会
会 議 録（第１号）
１．開 会 年 月 日  令和７年１２月１２日（金）
```

- 会議名: `{年号}年第{N}回府中町議会{定例会|臨時会}`
- 号数: `会 議 録（第{N}号）`
- 開催日: `開 会 年 月 日  {年号}年{M}月{D}日（{曜日}）`

#### 発言の構造

発言者パターン:

```
○議長（力山 彰君）
○副議長（森本 将文君）
○１０番（西山 優君）
○町長（寺尾 光司君）
○教育長（新田 憲章君）
○福祉保健部長（中本 孝弘君）
```

- `○` で始まり、役職 or 番号 + 括弧内に氏名 + `君`
- 発言内容は発言者行の後に続くテキスト
- 議事の区切り: `～～～～～～～～～○～～～～～～～～～` パターン

#### パース用正規表現（案）

```typescript
// 発言者の抽出
const speakerPattern = /^○(.+?)（(.+?)君）/;
// 例: ○議長（力山 彰君） → role="議長", name="力山 彰"
// 例: ○１０番（西山 優君） → role="１０番", name="西山 優"

// 開催日の抽出
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;

// 会議名の抽出
const sessionPattern = /(?:令和|平成)\S+年第\S+回府中町議会(定例会|臨時会)/;

// 議事区切りの検出
const separatorPattern = /^～+○～+$/;
```

---

## 注意事項

- 会議録は全て PDF 形式のため、HTML スクレイピングではなく PDF パースが必要
- PDF のテキスト抽出時、全角スペースが多用されている（例: `会 議 録`、`開 会 年 月 日`）
- 氏名の後に「君」が付く（例: `力山 彰君`）ため、パース時に除去が必要
- 出席議員・説明員のリストが本文 PDF の冒頭に含まれる（目録 PDF にも同様の情報あり）
- ページ番号が PDF 末尾に `- {N} -` 形式で付与される
- 年度別一覧ページの URL パス内の ID は連番ではないため、トップページからの収集が必須

---

## 推奨アプローチ

1. **3 階層クロール**: トップ → 年度別一覧 → 会議別詳細の順にリンクを辿り、本文 PDF の URL リストを作成
2. **本文 PDF のみ取得**: 目録 PDF はメタ情報のみで発言内容を含まないため、本文 PDF を優先的に取得
3. **PDF テキスト抽出**: `pdfplumber` 等を使用してテキストを抽出し、発言者パターンで分割
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 年度別ページ単位で新規会議の有無を確認し、未取得の会議のみをクロール
