# 北竜町議会 カスタムスクレイピング方針

## 概要

- サイト: http://www.town.hokuryu.hokkaido.jp/tyousei/gikai/gikaikaigiroku/
- 分類: WordPress（Cocoon テーマ）による PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は全て PDF ファイルで公開。検索システムなし。年度別ページに定例会・臨時会の PDF リンクが一覧掲載される。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（令和7年） | `http://www.town.hokuryu.hokkaido.jp/tyousei/gikai/gikaikaigiroku/` |
| 令和6年会議録 | `http://www.town.hokuryu.hokkaido.jp/gikaikaigiroku_r6` |
| 令和5年会議録 | `http://www.town.hokuryu.hokkaido.jp/gikaikaigiroku_r5` |
| 令和4年会議録 | `http://www.town.hokuryu.hokkaido.jp/gikaikaigiroku_r4` |
| 令和3年会議録 | `http://www.town.hokuryu.hokkaido.jp/gikaikaigiroku_r3` |
| 令和2年会議録 | `http://www.town.hokuryu.hokkaido.jp/gikaikaigiroku_r2` |
| 令和元年会議録 | `http://www.town.hokuryu.hokkaido.jp/gikaikaigiroku_r1` |
| PDF ファイル | `http://www.town.hokuryu.hokkaido.jp/coupl/{年}/{月}/g_giroku_{和暦略}.{月}.{日}.pdf` |

### PDF ファイル名パターン

| 和暦 | ファイル名例 |
| --- | --- |
| 令和7年 | `g_giroku_r7.3.11.pdf` |
| 令和6年 | `g_giroku_r6.3.11.pdf` |
| 平成31年 | `g_giroku31.3.11.pdf`（`_r` なし） |
| 令和元年 | `g_giroku_r1.6.20.pdf` |

---

## 年度別ページ URL の命名規則

| 年度 | URL スラッグ |
| --- | --- |
| 令和7年（最新） | `/tyousei/gikai/gikaikaigiroku/`（トップページ） |
| 令和6年 | `/gikaikaigiroku_r6` |
| 令和5年 | `/gikaikaigiroku_r5` |
| 令和4年 | `/gikaikaigiroku_r4` |
| 令和3年 | `/gikaikaigiroku_r3` |
| 令和2年 | `/gikaikaigiroku_r2` |
| 令和元年/平成31年 | `/gikaikaigiroku_r1` |

---

## 会議の種類

| 種類 | 説明 |
| --- | --- |
| 定例会 | 年4回程度開催。複数日にわたる場合あり（「1日目」「2日目」等） |
| 臨時会 | 不定期開催。通常1日で終了 |

---

## HTML 構造

### 年度別ページの本文構造

WordPress の `entry-content` 内に以下の構造でリンクが掲載される。

```html
<p>
  <strong>■定例会</strong><br>
  <i class="fas fa-file-pdf"></i>
  <a href="/../../coupl/2025/09/g_giroku_r7.3.11.pdf">第1回［令和7年3月11日］（1日目）</a><br>
  <i class="fas fa-file-pdf"></i>
  <a href="/../../coupl/2025/09/g_giroku_r7.3.12.pdf">第1回［令和7年3月12日］（2日目）</a><br>
  ...
</p>
<p>
  <strong>■臨時会</strong><br>
  <i class="fas fa-file-pdf"></i>
  <a href="/../../coupl/2024/05/g_giroku_r6.1.19.pdf">第1回［令和6年1月19日］</a><br>
  ...
</p>
```

### リンクテキストのパターン

```
第{回数}回［{和暦}年{月}月{日}日］（{日目}日目）  ← 定例会（複数日）
第{回数}回［{和暦}年{月}月{日}日］                ← 臨時会（1日）
```

### 過去年度へのリンク（トップページ内）

```html
<div class="wp-block-cocoon-blocks-button-1 button-block">
  <a href="/../../gikaikaigiroku_r6" class="btn btn-l ...">令和6年北竜町議会会議録</a>
</div>
```

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `/tyousei/gikai/gikaikaigiroku/` から過去年度へのボタンリンクを収集する。

- `wp-block-cocoon-blocks-button-1` クラスを持つ `div` 内の `a` タグから href を取得
- トップページ自体も最新年度の会議録を含むため、スクレイピング対象に含める
- URL パターン: `/gikaikaigiroku_r{数字}` で令和元年〜令和6年

### Step 2: 各年度ページから PDF リンクの収集

各年度ページの `entry-content` 内から PDF リンクを抽出する。

**収集方法:**

1. `entry-content` 内の `a[href$=".pdf"]` を Cheerio で全取得
2. リンクテキストから会議種別（定例会/臨時会）、回数、開催日を抽出
3. 会議種別は直前の `<strong>■定例会</strong>` または `<strong>■臨時会</strong>` で判定
4. href の相対パスを絶対 URL に変換（`/../../coupl/...` → `http://www.town.hokuryu.hokkaido.jp/coupl/...`）

**リンクテキストのパース用正規表現（案）:**

```typescript
// リンクテキストから情報を抽出
const linkPattern = /第(\d+)回［(.+?)(\d+)年(\d+)月(\d+)日］(?:（(\d+)日目）)?/;
// 例: "第1回［令和7年3月11日］（1日目）"
//   → 回数=1, 和暦="令和7", 月=3, 日=11, 日目=1

// 会議種別の判定
const meetingTypePattern = /■(定例会|臨時会)/;
```

### Step 3: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF は会議1日分の全文が1ファイルにまとまっている
- PDF パーサー（pdf-parse 等）でテキスト抽出を行う

---

## 注意事項

- PDF の href が相対パスで記載されており、`/../../coupl/...` のような形式のため、URL 解決時に注意が必要
- 平成31年の PDF ファイル名は `g_giroku31.x.x.pdf`（`_r` プレフィックスなし）だが、令和元年以降は `g_giroku_r1.x.x.pdf` のように `_r` が付く
- 最新年度の会議録はトップページ（`/tyousei/gikai/gikaikaigiroku/`）に直接掲載され、過去年度は別ページ（`/gikaikaigiroku_rN`）に分かれている
- 一部のアイコン表記が WordPress ショートコード形式 `[icon name="file-pdf" prefix="fas"]` で残っている場合がある（HTML レンダリング前の状態）
- 会議録の公開範囲は令和元年（平成31年）以降

---

## 推奨アプローチ

1. **全量取得を優先**: トップページ + 年度別ページ（r1〜r6）の計7ページから全 PDF リンクを収集
2. **PDF テキスト抽出**: pdf-parse 等で PDF からテキストを抽出し、発言内容をパース
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 各年度ページの PDF リンク数を前回と比較し、新規追加分のみダウンロードする
