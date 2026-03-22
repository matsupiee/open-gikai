# 南幌町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.nanporo.hokkaido.jp/about/politics/council/conference/
- 分類: WordPress（voteras カスタムブロック）による PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 本会議の会議録・一般質問を PDF 形式で年度別・会別に公開。議案・会議結果も PDF で提供。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（単一ページ） | `https://www.town.nanporo.hokkaido.jp/about/politics/council/conference/` |
| PDF ファイル | `https://www.town.nanporo.hokkaido.jp/files/{YYYY}/{MM}/{ファイル名}.pdf` |

### PDF ファイル名パターン

| 種別 | ファイル名例 |
| --- | --- |
| 会議録（定例会） | `令和７年第１回議会定例会会議録.pdf` |
| 会議録（臨時会） | `令和８年第１回臨時会会議録.pdf` |
| 一般質問 | `R7.1定一般質問.pdf`、`R6.1定一般質問（発言取り消し後）.pdf` |
| 会議結果 | `令和７年第１回定例会.pdf`、`令和７年第１回臨時会.pdf` |
| 議案 | `★議案まとめ.pdf`、`★議案まとめ-1.pdf`、`★議案まとめ（差替）-2.pdf` |
| 追加議案 | `追加議案①.pdf`、`追加議案②.pdf` |

---

## ページ構造

### HTML 構成

一覧ページは WordPress の voteras カスタムブロック（アコーディオン）で構成されている。

```
<h2> 議案・会議結果・会議録　令和X年（YYYY年）  ← 年度アコーディオン
  <h3> 定例会 / 臨時会                           ← 会議種別
    <h4> 第N回定例会 / 第N回臨時会               ← 個別の会
      <div class="wp-block-file">               ← PDF リンク
        <a href="...">会議録</a>
        <a href="..." class="wp-block-file__button" download>ダウンロード</a>
      </div>
```

### PDF リンクの HTML 構造

各 PDF は `div.wp-block-file` 内に 2 つの `<a>` タグで構成される:

```html
<div class="wp-block-file">
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf">会議録</a>
  <a href="https://www.town.nanporo.hokkaido.jp/files/2025/04/令和７年第１回議会定例会会議録.pdf"
     class="wp-block-file__button" download>ダウンロード</a>
</div>
```

- 1 つ目の `<a>`: リンクテキストが種別名（「会議録」「一般質問」「議案」等）
- 2 つ目の `<a>`: `class="wp-block-file__button"` + `download` 属性付き

### ページネーション

なし。全年度・全会議が単一ページに掲載されている。

---

## 公開範囲

| 年度 | 西暦 | 備考 |
| --- | --- | --- |
| 令和8年 | 2026年 | 最新（一部未公開） |
| 令和7年 | 2025年 | |
| 令和6年 | 2024年 | |
| 令和5年 | 2023年 | |
| 令和4年 | 2022年 | |
| 令和3年 | 2021年 | |
| 令和2年 | 2020年 | |
| 平成31年・令和元年 | 2019年 | |
| 平成30年 | 2018年 | |
| 平成29年 | 2017年 | |
| 平成28年 | 2016年 | |
| 平成27年 | 2015年 | 最古 |

各年度に定例会（年4回）と臨時会（年1〜6回程度）が含まれる。

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

一覧ページ `https://www.town.nanporo.hokkaido.jp/about/politics/council/conference/` から会議録 PDF のリンクを抽出する。

**収集方法:**

1. 一覧ページの HTML を取得
2. `div.wp-block-file` 内の最初の `<a>` タグを走査
3. リンクテキストが「会議録」または「一般質問」のものを対象として抽出
4. 親要素の `<h4>`（第N回定例会/臨時会）と `<h2>`（年度）からメタ情報を取得

**Cheerio での抽出例:**

```typescript
import * as cheerio from "cheerio";

const $ = cheerio.load(html);

const records: Array<{
  url: string;
  type: "会議録" | "一般質問";
  year: string;
  session: string;
}> = [];

// 各 wp-block-file を走査
$("div.wp-block-file").each((_, el) => {
  const $el = $(el);
  const $link = $el.find("a").first();
  const text = $link.text().trim();
  const href = $link.attr("href");

  // 会議録と一般質問のみ対象
  if (!href || (text !== "会議録" && text !== "一般質問")) return;

  // 親要素から年度・会名を取得
  const h4 = $el.prevAll("div.wp-block-voteras-custom-title-h4").first().text().trim();
  const h2 = $el.closest(".accordion-content").prev(".accordion-title").find("h2").text().trim();

  records.push({
    url: href,
    type: text as "会議録" | "一般質問",
    year: h2,
    session: h4,
  });
});
```

### Step 2: PDF のダウンロードとテキスト抽出

1. 収集した URL から PDF をダウンロード
2. PDF パーサー（pdf-parse 等）でテキストを抽出
3. PDF ファイル名から会議種別・年度・回数を正規表現で解析

**ファイル名からのメタ情報抽出:**

```typescript
// 会議録ファイル名パターン
const kaigirokuPattern = /^(令和|平成)(\d+)年第(\d+)回(議会定例会|臨時会)会議録/;
// 例: "令和７年第１回議会定例会会議録.pdf"
//   → era="令和", year="７", num="１", type="議会定例会"

// 一般質問ファイル名パターン
const ippanPattern = /^R(\d+)\.(\d+)定一般質問/;
// 例: "R7.1定一般質問.pdf"
//   → year="7"(令和), num="1"(第1回)
```

### Step 3: テキストデータの保存

- PDF から抽出したテキストを会議録レコードとして保存
- メタ情報（年度、会議種別、回数、日付）を付与

---

## 注意事項

- PDF ファイルのため、テキスト抽出の精度は PDF の作成方法に依存する（画像 PDF の場合は OCR が必要）
- ファイル名に全角数字・特殊文字（★、①②等）が含まれるため、URL エンコーディングに注意
- 一般質問の PDF ファイル名は年度によって命名規則が異なる（例: `R5.1定一般質問R5.1定.pdf` のような冗長な名前もある）
- 「発言取り消し後」のような差し替え版が存在する場合がある
- 議案・会議結果の PDF は会議録ではないため、スクレイピング対象外とする

---

## 推奨アプローチ

1. **単一ページ取得**: 全データが 1 ページに集約されているため、HTML の取得は 1 回で済む
2. **リンクテキストでフィルタ**: `div.wp-block-file` 内の最初の `<a>` のテキストが「会議録」「一般質問」のものだけを対象にする
3. **レート制限**: PDF ダウンロード時にリクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 前回取得済みの PDF URL リストと比較し、新規分のみダウンロードする
5. **PDF テキスト品質チェック**: 抽出テキストが極端に短い・空の場合は画像 PDF の可能性があるためログに記録する
