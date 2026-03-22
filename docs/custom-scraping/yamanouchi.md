# 山ノ内町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.yamanouchi.nagano.jp/soshiki/gikai_jimukyoku/gyomu/gikai/520.html
- 分類: 自治体公式サイト（SMART CMS）上で PDF ファイルを直接公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 公開形式: PDF（定例会・臨時会ごとに複数の PDF ファイル）
- 公開範囲: 令和7年（2025年）〜 平成24年（2012年）

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議事録一覧（単一ページ） | `https://www.town.yamanouchi.nagano.jp/soshiki/gikai_jimukyoku/gyomu/gikai/520.html` |
| PDF ファイル | `https://www.town.yamanouchi.nagano.jp/material/files/group/38/{ファイル名}.pdf` |

### PDF ファイル名の命名規則

ファイル名に統一的な命名規則はなく、年代によって異なるパターンが混在する。

| 年代 | パターン例 | 説明 |
| --- | --- | --- |
| 令和7年（新しい方式） | `mokuji12gatu.pdf`, `syonoti28.pdf`, `ittupannsitumonn1.pdf` | ローマ字表記、統一性なし |
| 令和7年（別方式） | `070829mokuji.pdf`, `070903shitumon.pdf` | `YYMMDD` + 内容 |
| 令和6年〜令和元年 | `R061129_mokuji.pdf`, `R060829_syoniti.pdf` | `R + YY + MMDD + _ + 内容` |
| 平成31年〜平成27年 | `H310228_mokuji.pdf`, `H300611_situmon.pdf` | `H + YY + MMDD + _ + 内容` |
| 平成26年 | `gijiroku_26_6_1.pdf` | `gijiroku_ + 和暦年 + _ + 月 + _ + 連番` |
| 平成25年〜平成24年 | `gijiroku_25_6.pdf`, `gijiroku_24_1.pdf` | `gijiroku_ + 和暦年 + _ + 連番` |

---

## ページ構造

### 一覧ページの HTML 構造

全ての議事録が **単一ページ** に掲載されている（ページネーションなし）。

```
<div class="free-layout-area">
  <h2>議事録</h2>
  <h3>令和7年第6回定例会（12月）</h3>
  <div class="wysiwyg">
    <p><a target="_blank" class="icon2" href="//www.town.yamanouchi.nagano.jp/material/files/group/38/xxx.pdf">・目 次</a></p>
    <p><a target="_blank" class="icon2" href="//www.town.yamanouchi.nagano.jp/material/files/group/38/xxx.pdf">・11月28日 初日</a></p>
    <p><a target="_blank" class="icon2" href="//www.town.yamanouchi.nagano.jp/material/files/group/38/xxx.pdf">・12月4日 一般質問</a>（1.髙田佳久　2.湯本晴彦　3.畔上恵子　4.山本光俊）</p>
    ...
  </div>
  <h3>令和7年第5回定例会（9月）</h3>
  <div class="wysiwyg">...</div>
  ...
</div>
```

- `<h3>` タグに定例会・臨時会の名称（例: `令和7年第6回定例会（12月）`）
- `<div class="wysiwyg">` 内に PDF リンクの `<p><a>` 要素
- PDF リンクのテキストに日付と内容種別（目次、初日、一般質問、議案審議、最終日など）
- 一般質問には括弧内に質問者名リスト（例: `（1.髙田佳久　2.湯本晴彦　3.畔上恵子）`）
- 古い PDF リンクには `file_size` 属性が付与されている場合がある

### 会議の種別

各定例会・臨時会は以下の日程で構成される:

| 種別 | 説明 |
| --- | --- |
| 目次 | 定例会全体の目次 |
| 初日 | 開会日の議事録 |
| 一般質問 | 1〜2日に分かれることが多い |
| 議案審議 | 議案の審議（一般質問と同日の場合あり） |
| 最終日 | 閉会日の議事録 |
| 臨時会 | 臨時会は1日のみの場合が多い |

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

議事録一覧ページ（単一ページ）から全ての PDF リンクを抽出する。

**収集方法:**

1. `https://www.town.yamanouchi.nagano.jp/soshiki/gikai_jimukyoku/gyomu/gikai/520.html` を取得
2. `<h3>` タグから定例会・臨時会名を抽出（例: `令和7年第6回定例会（12月）`）
3. 各 `<h3>` の直後の `<div class="wysiwyg">` 内から `<a>` タグの `href` 属性で PDF URL を抽出
4. リンクテキストから日付と内容種別を抽出

**抽出データ:**

```typescript
interface PdfEntry {
  sessionName: string;    // "令和7年第6回定例会（12月）"
  date: string;           // "11月28日" or "12月4日"
  type: string;           // "目次" | "初日" | "一般質問" | "議案審議" | "最終日" | "臨時会"
  speakers?: string[];    // ["髙田佳久", "湯本晴彦", ...]（一般質問の場合）
  pdfUrl: string;         // "https://www.town.yamanouchi.nagano.jp/material/files/group/38/xxx.pdf"
}
```

### Step 2: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）でテキスト化
- 目次 PDF は会議全体の構成を把握するために参考にできるが、本文としてはスキップ可

### Step 3: テキストのパース

#### メタ情報

`<h3>` タグの定例会名から以下を抽出:

```
令和7年第6回定例会（12月）
```

- 年号: `令和7年` → 西暦 2025 年
- 回次: `第6回`
- 種別: `定例会` or `臨時会`
- 月: `12月`

リンクテキストから開催日を抽出:

```
・12月4日 一般質問
```

#### パース用正規表現（案）

```typescript
// 定例会・臨時会名の抽出
const sessionPattern = /(令和|平成)(\d+)年第(\d+)回(定例会|臨時会)(?:（(\d+)月）)?/;
// 例: 令和7年第6回定例会（12月） → era="令和", year=7, num=6, type="定例会", month=12

// リンクテキストから日付と種別の抽出
const linkPattern = /(\d+)月\s*(\d+)日\s*(初日|一般質問|議案審議|最終日|臨時会|一般質問・議案審議)/;

// 一般質問の質問者名リスト抽出
const speakersPattern = /（([\d\.\s\S]+?)）/;
// 個々の質問者: /\d+\.(.+?)(?:\s|$)/g
```

---

## データ規模

- 定例会・臨時会数: 約 66 回（令和7年〜平成24年）
- PDF ファイル数: 約 322 件
- 年間平均: 約 4〜6 回の定例会・臨時会、各 4〜7 件の PDF

---

## 注意事項

- 全ての議事録が **1 つの HTML ページ** に掲載されているため、ページネーション処理は不要
- PDF ファイルのリンクは `//www.town.yamanouchi.nagano.jp/...` 形式（プロトコル相対 URL）のため、`https:` を付加する必要がある
- PDF ファイル名に統一的な命名規則がないため、ファイル名からメタ情報を推定するのは困難。`<h3>` タグとリンクテキストからメタ情報を取得する
- リンクテキストの書式が年代によって微妙に異なる（`・` の位置、全角スペースの使い方など）
- 一般質問と議案審議が同日の場合、リンクテキストが `一般質問・議案審議` となる

---

## 推奨アプローチ

1. **単一ページ取得で完結**: 一覧ページ 1 回の取得で全 PDF リンクを収集可能（ページネーションなし）
2. **h3 + wysiwyg の構造を活用**: `<h3>` で定例会を区切り、直後の `<div class="wysiwyg">` 内の `<a>` タグで PDF URL を取得する
3. **PDF テキスト抽出**: PDF パーサーを使って本文テキストを抽出し、発言内容をパースする
4. **レート制限**: PDF ダウンロード時はリクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: ページの `更新日` メタ情報（`<p class="update">更新日：2026年02月13日</p>`）を監視し、更新があった場合のみ再取得する
