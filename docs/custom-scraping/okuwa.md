# 大桑村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.okuwa.lg.jp/okuwa/gikai/index.html
- 分類: 議会だより（PDF）を公式サイトで掲載（会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録テキストの公開はなく、議会だより PDF のみが情報源

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.vill.okuwa.lg.jp/okuwa/gikai/index.html` |
| 議会だより一覧（令和5年〜） | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/gikaidayori.html` |
| 議会だより一覧（平成30年〜令和4年） | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/gikaidayori_H30-R4.html` |
| 議会だより一覧（平成25年〜平成29年） | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/gikaidayori_2.html` |
| 議会だより PDF（令和5年〜） | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/documents/gikaidayori/{ファイル名}.pdf` |
| 議会だより PDF（平成30年〜令和4年） | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/documents/gikaidayori_H30-R4/{ファイル名}.pdf` |
| 議会だより PDF（平成25年〜平成29年） | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/documents/gikaidayori_2/{ファイル名}.pdf` |
| 議員名簿 | `https://www.vill.okuwa.lg.jp/okuwa/gikai/giinmeibo.html` |
| 議会構成 | `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaikousei.html` |

---

## 議会だよりの掲載範囲

| 期間 | 号数 | 一覧ページ |
| --- | --- | --- |
| 令和5年〜現在 | 第171号〜第183号 | `gikaidayori.html` |
| 平成30年〜令和4年 | 第151号〜第170号 | `gikaidayori_H30-R4.html` |
| 平成25年〜平成29年 | 第131号〜第150号 | `gikaidayori_2.html` |

- 年4回発行（1月・4月・7月・10月頃）
- 号外が不定期に発行される場合あり

---

## PDF ファイル名の命名規則

ファイル名に統一的な命名規則はなく、時期によって異なる。

| パターン | 例 |
| --- | --- |
| `gikaihou{号数}.pdf` | `gikaihou183.pdf`, `gikaihou178.pdf` |
| `gikaidayori{号数}.pdf` | `gikaidayori150.pdf`, `gikaidayori131.pdf` |
| `gikaidayori_{号数}.pdf` | `gikaidayori_172.pdf` |
| `gikai_{号数}.pdf` | `gikai_175.pdf`, `gikai_174.pdf` |
| 年月ベース | `gikaidayori_R4.12.pdf`, `gikaidayori_R4.09.pdf` |
| 号外 | `gikaihou_gougai2.pdf`, `gikai_gougai.pdf`, `gikaidayori_H27gougai.pdf` |

---

## HTML 構造

### 一覧ページの構造

議会だより一覧は `<ul>/<li>` のリスト形式で構成される。

```html
<ul>
  <li>
    <a target="_blank" href="/okuwa/gikai/gikaidayori/documents/gikaidayori/gikaihou183.pdf">
      議会だより第183号　令和８年１月22日発行（1,841.4kbyte）
    </a>
  </li>
  <!-- ... -->
</ul>
```

- 各 `<li>` 内の `<a>` タグに PDF への相対パスが含まれる
- リンクテキストに号数・発行日・ファイルサイズが記載される
- 一部のリンクは `href` 属性が空（例: 第180号）の場合があり、PDF 未公開の可能性
- ページネーションなし（各ページに全件表示）

### 議会トップページの動的読み込み

議会トップページ（`index.html`）は `OkuwaUtil` という独自 JavaScript で動的にコンテンツを読み込む。

```javascript
OkuwaUtil("#genre_407").load("/template/genre_article_list.html", "#genreid_407")
OkuwaUtil("#genre_408").load("/template/genre_article_list.html", "#genreid_408")
```

一覧ページ（`gikaidayori.html` 等）は静的 HTML のため、スクレイピング対象としてはこちらを使用する。

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

3 つの一覧ページから PDF の URL を収集する。

**収集方法:**

1. 以下の 3 ページを取得:
   - `gikaidayori.html`（令和5年〜）
   - `gikaidayori_H30-R4.html`（平成30年〜令和4年）
   - `gikaidayori_2.html`（平成25年〜平成29年）
2. 各ページの `<a>` タグから `href` 属性が `.pdf` で終わるリンクを抽出
3. リンクテキストから号数・発行日を正規表現で抽出

**抽出用正規表現（案）:**

```typescript
// リンクテキストから号数と発行日を抽出
const issuePattern = /議会だより第(\d+)号\s+(.+?)発行/;
// 例: "議会だより第183号　令和８年１月22日発行" → 号数="183", 発行日="令和８年１月22日"

// 号外の検出
const extraPattern = /議会だより号外\s+(.+?)発行/;

// 発行日の解析
const datePattern = /(令和|平成)(\d+)年(\d+)月(\d+)日/;
```

### Step 2: PDF のダウンロード

収集した URL から PDF をダウンロードする。

- PDF ファイルサイズは 300KB〜15MB 程度
- `target="_blank"` で開かれる直接ダウンロードリンク

### Step 3: PDF からのテキスト抽出

議会だより PDF は紙面レイアウトのスキャンデータではなく、テキスト埋め込み PDF と想定される。

- PDF パーサー（pdf-parse 等）でテキストを抽出
- 議会だよりの構成（議案審議結果、一般質問、委員会報告等）に基づいてセクション分割
- 発言者・質問者の抽出は PDF のレイアウトに依存するため、実際の PDF を確認して判断

---

## 議会の構成情報

### 常任委員会

| 委員会名 | 委員長 |
| --- | --- |
| 総務社会常任委員会 | 勝野清子 |
| 経済建設常任委員会 | 洞野宏 |

### 特別委員会

| 委員会名 | 委員長 |
| --- | --- |
| 議会報編集特別委員会 | 瓜尾美佐子 |
| 議会改革特別委員会 | 瓜尾美佐子 |

---

## 注意事項

- 会議録テキスト（HTML）の公開はなく、議会だより（PDF）のみが公開されている
- PDF のファイル名に統一的な命名規則がないため、リンクテキストからメタ情報を取得する必要がある
- 一部の号（第180号など）は `href` 属性が空でリンク切れの場合がある
- 議会トップページは JavaScript で動的にコンテンツを読み込むため、一覧ページ（`gikaidayori.html` 等）を直接取得する

---

## 推奨アプローチ

1. **一覧ページからの PDF URL 収集を優先**: 3 ページの静的 HTML から全 PDF リンクを収集
2. **PDF テキスト抽出の品質確認**: 実際の PDF をダウンロードし、テキスト抽出が可能か（スキャン画像ではないか）を確認
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 一覧ページの先頭に最新号が追加されるため、既知の号数以降のみを取得する差分更新が可能
