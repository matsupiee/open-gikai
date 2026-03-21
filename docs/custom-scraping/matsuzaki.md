# 松崎町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.matsuzaki.shizuoka.jp/categories/guide/chogikai/kaigiroku/
- 分類: 町公式サイト内の年度別 PDF 直リンク一覧（専用検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録は年度単位または会議単位の個別ページに PDF が掲載される構造

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 一覧トップ | `https://www.town.matsuzaki.shizuoka.jp/categories/guide/chogikai/kaigiroku/` |
| 全件一覧（1ページ目） | `https://www.town.matsuzaki.shizuoka.jp/categories/guide/chogikai/kaigiroku/more@docs.html` |
| 全件一覧（2ページ目以降） | `https://www.town.matsuzaki.shizuoka.jp/categories/guide/chogikai/kaigiroku/more@docs.p{N}.html` |
| 会議録詳細ページ | `https://www.town.matsuzaki.shizuoka.jp/docs/{ID}/` |
| PDF ファイル | `https://www.town.matsuzaki.shizuoka.jp/docs/{ID}/file_contents/{ファイル名}.pdf` |

---

## 一覧ページの構造

全件一覧は 3 ページに分かれており、各ページに約 28〜30 件のエントリが掲載される。ページネーションは `more@docs.p{N}.html` 形式。

各エントリは以下の形式:

```
タイトル（例: 令和６年松崎町議会会議録）
└─ /docs/{ID}/ へのリンク
```

エントリには以下の 2 種類の粒度が混在する:

- **年度まとめ型**: 令和4年以降は年度単位で1エントリにまとめられており、詳細ページに複数の会議録 PDF が掲載される
- **会議単位型**: 令和3年以前の一部および平成時代は会議単位（第N回定例会など）でエントリが作られており、詳細ページに1件の PDF が掲載される

---

## 会議録詳細ページの構造

詳細ページ（`/docs/{ID}/`）に PDF ファイルへのリンクが掲載される。

### 年度まとめ型の例（令和6年）

```
令和６年松崎町議会会議録
├─ 第１回臨時会（2024年1月19日）      → 20240119r01kaigiroku.pdf
├─ 第１回定例会（2024年3月6日〜13日）  → r06031kaigiroku.pdf
├─ 第２回臨時会（2024年3月29日）      → 20240329r02kaigiroku.pdf
├─ 第３回臨時会（2024年5月10日）      → 20240510r03kaigiroku.pdf
├─ 第２回定例会（2024年6月4日〜6日）   → 令和6年第2回定例会（...）.pdf
├─ 第３回定例会（2024年9月3日〜5日）   → r06093kaigiroku.pdf
├─ 第４回臨時会（2024年11月5日）      → 20241105r04kaigiroku.pdf
└─ 第４回定例会（2024年12月3日〜4日）  → 20241205t04kaigiroku.pdf
```

### 会議単位型の例（平成29年第1回定例会）

```
平成29年松崎町議会第1回定例会議事録
└─ h29t1kaigiroku.pdf
```

---

## PDF ファイル名の命名規則

ファイル名は時代・年度によって統一されておらず、複数の命名規則が混在する。

| パターン | 例 |
| --- | --- |
| `{YYYYMMDD}t{N}kaigiroku.pdf` | `20221206t04kaigiroku.pdf`（定例会） |
| `{YYYYMMDD}r{N}kaigiroku.pdf` | `20220117r01kaigiroku.pdf`（臨時会） |
| `r{年号年}{月}{回}kaigiroku.pdf` | `r06031kaigiroku.pdf` |
| `h{年号年}t{回}kaigiroku.pdf` | `h29t1kaigiroku.pdf` |
| 日本語ファイル名 | `令和6年第2回定例会（令和6年6月4日～6日）.pdf` |

---

## 掲載期間

全件一覧（3ページ）を通じて確認できる最古の会議録は平成24年（2012年）度分まで遡る。

| 期間 | エントリ数（概算） |
| --- | --- |
| 令和4年〜令和7年 | 年度まとめ型（各年1エントリ） |
| 令和元年〜令和3年 | 会議単位型（各会議1エントリ） |
| 平成24年〜平成31年 | 会議単位型（各会議1エントリ） |

---

## スクレイピング戦略

### Step 1: 詳細ページ URL の収集

全件一覧ページ（3ページ）をクロールし、`/docs/{ID}/` へのリンクを収集する。

```
1ページ目: /categories/guide/chogikai/kaigiroku/more@docs.html
2ページ目: /categories/guide/chogikai/kaigiroku/more@docs.p2.html
3ページ目: /categories/guide/chogikai/kaigiroku/more@docs.p3.html
```

各ページから `<a href="/docs/{ID}/">` 形式のリンクを抽出する。

### Step 2: 詳細ページから PDF リンクを抽出

各詳細ページ（`/docs/{ID}/`）を取得し、以下を抽出する:

- 会議名（例: 第１回定例会、第２回臨時会）
- 開催日（例: 令和6年3月6日〜13日）
- PDF ファイルのリンク（`file_contents/{ファイル名}.pdf`）

PDF の絶対 URL は以下の形式で構築する:

```
https://www.town.matsuzaki.shizuoka.jp/docs/{ID}/file_contents/{ファイル名}.pdf
```

### Step 3: PDF の取得とパース

PDF から会議録テキストを抽出する。ファイルサイズは定例会で約 1〜3MB、臨時会で約 200KB〜1.2MB 程度。

---

## 注意事項

- PDF ファイル名の命名規則が年度・会議によって異なるため、ファイル名からのメタ情報推定は行わず、詳細ページの HTML から会議名・開催日を取得する
- 一部のファイル名が日本語を含む（例: `令和6年第2回定例会（...）.pdf`）ため、URL エンコードが必要
- 年度まとめ型と会議単位型が混在するため、詳細ページの HTML を解析して会議ごとの PDF を識別する
- レート制限: リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **全件一覧の 3 ページをクロール**して `/docs/{ID}/` の URL リストを作成（計 60〜90 件程度）
2. **各詳細ページを取得**し、会議名・開催日・PDF リンクを Cheerio でパース
3. **PDF をダウンロード**してテキスト抽出
4. **差分更新**: 取得済みの `/docs/{ID}/` リストを管理し、新規追加分のみを処理する
