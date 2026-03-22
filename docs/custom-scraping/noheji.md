# 野辺地町議会（青森県） カスタムスクレイピング方針

## 概要

- サイト: https://www.town.noheji.aomori.jp/life/chosei/gikai/2787
- 分類: 町公式サイト（concrete5 CMS）で会議録を PDF 公開
- 文字コード: UTF-8
- 特記: 令和3年（2021年）〜令和7年（2025年）の会議録を年度別・定例会/臨時会別に掲載。会議録は PDF ファイルでダウンロード提供

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.noheji.aomori.jp/life/chosei/gikai/2787` |
| 年度別一覧ページ | `https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/{年度ID}` |
| 定例会/臨時会ページ | `https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/{パスセグメント}` |
| PDF ダウンロード（リダイレクト） | `https://www.town.noheji.aomori.jp/download_file/view/{fileID}/{pageID}` |
| PDF 実体 | `https://www.town.noheji.aomori.jp/application/files/{hash}/{filename}.pdf` |

---

## HTML 構造

### 会議録一覧ページ（トップ）

トップページには年度別・定例会別のナビゲーションが `<ul>` のネストリストとして掲載されている。

```html
<div class="contents_area" role="main" id="contents">
  <h2>会議録</h2>
  <ul class="nav">
    <li>
      <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/3">令和３年　会議録</a>
      <ul>
        <li>
          <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/202112">令和３年第７回１２月定例会</a>
        </li>
      </ul>
    </li>
    <li>
      <a href="https://www.town.noheji.aomori.jp/life/chosei/gikai/2787/4">令和４年　会議録</a>
      <ul>
        <li><a href="...">令和４年第１回３月定例会</a></li>
        <li><a href="...">令和４年第２回６月定例会</a></li>
        <!-- ... -->
      </ul>
    </li>
    <!-- 令和5年〜令和7年も同様 -->
  </ul>
</div>
```

### 定例会/臨時会ページ（個別）

各定例会ページには、会議録 PDF へのダウンロードリンクが `<p><a>` で掲載される。

```html
<div class="contents_area" role="main" id="contents">
  <h2>令和３年第７回１２月定例会</h2>
  <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6249/2834">本会議会議録目次</a></p>
  <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6250/2834">本会議第１号（１２月　８日）【開会、提案理由説明、委員会報告】</a></p>
  <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6251/2834">本会議第２号（１２月　９日）【一般質問】</a></p>
  <p><a href="https://www.town.noheji.aomori.jp/download_file/view/6252/2834">本会議第３号（１２月１０日）【議案審議、陳情等審議、閉会】</a></p>
</div>
```

### PDF ダウンロード URL の挙動

`/download_file/view/{fileID}/{pageID}` は HTTP 303 リダイレクトで PDF 実体 URL に転送される。

```
GET /download_file/view/6249/2834
→ 303 See Other
→ Location: /application/files/3116/4601/1054/0312_.pdf
```

---

## ページネーション

なし。トップページに全年度・全定例会/臨時会へのリンクが一括掲載されている。

---

## 掲載年度範囲

令和3年（2021年）〜 令和7年（2025年）

---

## 会議種別

定例会と臨時会の両方が掲載されている。

### 定例会/臨時会の一覧

| 年度 | 会議名 |
| --- | --- |
| 令和3年 | 第7回12月定例会 |
| 令和4年 | 第1回3月定例会、第2回6月定例会、第3回8月臨時会、第4回9月定例会、第5回11月臨時会、第6回12月定例会 |
| 令和5年 | 第1回3月定例会、第2回5月臨時会、第3回6月定例会、第4回6月臨時会、第5回8月臨時会、第6回9月定例会、第7回10月臨時会、第8回12月定例会 |
| 令和6年 | 第1回3月定例会、第2回6月定例会、第3回7月臨時会、第4回9月定例会、第5回12月定例会 |
| 令和7年 | 第1回3月定例会、第2回5月臨時会、第3回6月定例会、第4回9月定例会、第5回12月定例会 |

---

## PDF リンクテキストのフォーマット

```
本会議会議録目次
本会議第{N}号（{M}月{DD}日）【{内容}】
```

例:
- `本会議会議録目次`
- `本会議第１号（１２月　８日）【開会、提案理由説明、委員会報告】`
- `本会議第２号（１２月　９日）【一般質問】`
- `本会議第３号（１２月１０日）【議案審議、陳情等審議、閉会】`

数字は全角で表記される。日付の1桁部分には全角スペースが入る場合がある（例: `１２月　８日`）。

---

## スクレイピング戦略

### Step 1: 定例会/臨時会ページ URL の収集

トップページ `https://www.town.noheji.aomori.jp/life/chosei/gikai/2787` から、定例会/臨時会の個別ページへのリンクをすべて収集する。

- `<ul class="nav">` 内のネストされた `<li>` > `<a>` からリンクを取得
- 第1階層（年度リンク）ではなく、第2階層（定例会/臨時会リンク）を対象とする
- ページネーションなし。1リクエストで全リンクを取得可能

```typescript
const sessionLinks = $('ul.nav > li > ul > li > a')
  .map((_, el) => ({
    url: $(el).attr('href'),
    title: $(el).text().trim(),  // 例: "令和３年第７回１２月定例会"
  }))
  .get();
```

### Step 2: 各定例会ページから PDF リンクを収集

各定例会/臨時会ページにアクセスし、PDF ダウンロードリンクを取得する。

- `<div class="contents_area">` 内の `<a>` で `href` に `/download_file/view/` を含むものを対象
- リンクテキストから会議号数・開催日・内容を抽出

```typescript
const pdfLinks = $('div.contents_area a[href*="/download_file/view/"]')
  .map((_, el) => ({
    downloadUrl: $(el).attr('href'),
    text: $(el).text().trim(),
  }))
  .get();
```

### Step 3: PDF のダウンロードとテキスト抽出

1. `/download_file/view/{fileID}/{pageID}` にアクセス（リダイレクトを追跡して実体 URL を取得）
2. PDF をダウンロード
3. pdf-parse 等でテキスト抽出

### パース用正規表現（案）

```typescript
// 定例会タイトルから年度・回数・月・種別を抽出
const sessionPattern = /令和([\d３４５６７８９０１２]+)年第([\d１２３４５６７８９０]+)回([\d１２３４５６７８９０]+)月(定例会|臨時会)/;

// PDF リンクテキストから会議号数・開催日・内容を抽出
const meetingPattern = /本会議第([\d１２３４５６７８９０]+)号（([\d１２３４５６７８９０]+)月[\s　]*([\d１２３４５６７８９０]+)日）【(.+?)】/;
```

---

## 注意事項

- **全角数字**: タイトル・リンクテキスト内の数字はすべて全角で表記される。パース時に半角変換が必要
- **全角スペース**: 日付の1桁部分に全角スペースが挿入される場合がある（例: `１２月　８日`）
- **PDF リダイレクト**: ダウンロード URL は 303 リダイレクトで実体 PDF に転送される。HTTP クライアントのリダイレクト追跡を有効にする必要がある
- **URL パスの不規則性**: 定例会ページの URL パス（`202112`、`413`、`426` 等）に一貫したルールがない。必ずトップページからリンクを収集する
- **CMS**: concrete5 ベースのサイト。CMS のアップデートで HTML 構造が変わる可能性がある
- **目次 PDF**: 各定例会の最初のリンクは「本会議会議録目次」であり、会議録本文ではない。スクレイピング対象から除外するか別扱いにする

---

## 推奨アプローチ

1. **トップページを起点にする**: 1リクエストで全定例会/臨時会ページの URL を収集できる
2. **2段階クロール**: トップページ → 定例会ページ → PDF ダウンロードの2段階で処理する
3. **リダイレクト対応**: PDF ダウンロード URL は 303 リダイレクトするため、リダイレクト追跡を有効にする
4. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
5. **差分更新**: 既取得の PDF URL リストと比較し、新規 URL のみを取得する
