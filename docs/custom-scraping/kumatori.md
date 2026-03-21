# 熊取町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/index.html
- 分類: 町公式サイト内での直接公開（会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で提供。年度別の一覧ページから各定例会・臨時会・委員会ごとの PDF をダウンロードする方式。平成28年〜令和7年の10年度分が公開されている。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/index.html` |
| 年度別一覧ページ | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/{ページID}.html` |
| 会議録 PDF | `https://www.town.kumatori.lg.jp/material/files/group/30/{ファイル名}.pdf` |

### 年度別ページ URL 一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/14305.html` |
| 令和6年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/12952.html` |
| 令和5年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/11535.html` |
| 令和4年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/8509.html` |
| 令和3年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/1945.html` |
| 令和2年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/1944.html` |
| 平成31年・令和元年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/1943.html` |
| 平成30年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/1910.html` |
| 平成29年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/1909.html` |
| 平成28年 | `https://www.town.kumatori.lg.jp/soshiki/gikai_somu/gyomu/kumatori_gikai/etsuran/1908.html` |

---

## ページ構造

### 会議録一覧トップページ

- 年度別のリンクが一覧表示される（10年度分）
- ページネーションなし（全年度が1ページに表示）
- 各リンクは「令和X年 町議会・委員会会議録」形式のテキスト

### 年度別一覧ページ

- 各年度の定例会・臨時会・委員会・全員協議会・特別委員会の会議録 PDF へのリンクが一覧表示される
- PDF へのリンクは `<a href="...pdf">` 形式で直接掲載
- 会議種別ごとにセクション分けされている
- ページネーションなし

---

## 会議種別

```
├─ 定例会（年4回：3月、6月、9月、12月）
│  ├─ 本会議
│  └─ 議会運営委員会・常任委員会
├─ 臨時会（必要に応じて）
│  ├─ 本会議
│  └─ 議会運営委員会
├─ 議員全員協議会（年4回程度）
├─ 予算審査特別委員会（3月定例会時）
├─ 決算審査特別委員会（9月定例会時）
└─ その他特別委員会
   ├─ 原子力問題調査特別委員会
   ├─ 都市計画道路建設促進特別委員会
   ├─ 環境施設広域化調査特別委員会
   └─ 議会改革検討特別委員会
```

---

## PDF ファイル名パターン

PDF は全て `https://www.town.kumatori.lg.jp/material/files/group/30/` 配下に格納されている。

### 命名規則

ファイル名は統一的な命名規則がなく、年度や時期によって表記ゆれがある。主なパターン:

| パターン | 例 | 説明 |
| --- | --- | --- |
| `R{年2桁}{月2桁}T-honkaigi.pdf` | `R0612T-honkaigi.pdf` | 令和6年12月定例会本会議 |
| `R{年2桁}{月2桁}T-iinkai.pdf` | `R0612T-iinkai.pdf` | 令和6年12月定例会委員会 |
| `R{年2桁}{月2桁}-teireikai.pdf` | `R0609-teireikai.pdf` | 令和6年9月定例会本会議 |
| `R{年2桁}{月2桁}-iinkai.pdf` | `R0609-iinkai.pdf` | 令和6年9月定例会委員会 |
| `R{年2桁}{月2桁}teireikai.pdf` | `R0406teireikai.pdf` | 令和4年6月定例会（ハイフンなし） |
| `R{年2桁}{月2桁}rinjikai.pdf` | `R0411rinjikai.pdf` | 令和4年11月臨時会 |
| `R{日付}-R1-honkaigi.pdf` | `R060527-R1-honkaigi.pdf` | 令和6年5月27日第1回臨時会本会議 |
| `R{年2桁}{月2桁}{日2桁}-zenkyou.pdf` | `R061212-zenkyou.pdf` | 令和6年12月12日全員協議会 |
| `R{年2桁}{月2桁}-kessanshinsa.pdf` | `R0609-kessanshinsa.pdf` | 決算審査特別委員会 |
| `R{年2桁}{月2桁}T-yosan-tokubetsu.pdf` | `R0603T-yosan-tokubetsu.pdf` | 予算審査特別委員会 |
| `H{年2桁}{月2桁}T-honkaigi.pdf` | `H3006T-honkaigi.pdf` | 平成30年6月定例会本会議 |

※ ファイル名のパターンが年度によって異なるため、ファイル名からメタ情報を推定するのは困難。必ずページ上のリンクテキストからメタ情報を取得すること。

---

## スクレイピング戦略

### Step 1: 年度別一覧ページの URL 収集

会議録一覧トップページ `etsuran/index.html` から各年度ページへのリンクを抽出する。

```typescript
// 年度別ページリンクの抽出
const yearLinks = $('a[href*="/etsuran/"]')
  .filter((_, el) => $(el).attr('href')?.match(/\/etsuran\/\d+\.html$/))
  .map((_, el) => $(el).attr('href'))
  .get();
```

### Step 2: PDF リンクの収集

各年度ページにアクセスし、PDF ファイルへのリンクとリンクテキスト（会議名・日付情報）を抽出する。

```typescript
// PDF リンクの抽出
const pdfLinks = $('a[href$=".pdf"]').map((_, el) => ({
  url: $(el).attr('href'),
  text: $(el).text().trim(), // リンクテキストにメタ情報が含まれる
})).get();
```

### Step 3: メタ情報の取得

PDF リンクのテキストから以下を抽出:

- 会議種別: 本会議 / 常任委員会 / 議会運営委員会 / 全員協議会 / 特別委員会
- 開催日: リンクテキスト内の日付表記（例: 「12月4日、5日、6日、17日」）
- 定例会/臨時会区分: リンクテキストまたはセクション見出しから判定

### Step 4: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、PDF パーサーでテキストを抽出する。

- PDF は A4 サイズ（595.276 x 841.89 ポイント）
- 本会議の会議録は 100〜200 ページ程度の大きなファイル（1.5〜2.0MB）
- 委員会は比較的小さい（100KB〜1MB 程度）

---

## 注意事項

- PDF ファイル名の命名規則が統一されていないため、ファイル名からのメタ情報推定は不可。ページ上のリンクテキストを正とすること
- PDF は圧縮されたバイナリ形式。テキスト抽出には PDF パーサーライブラリ（pdf-parse 等）が必要
- 年度ページの URL に含まれるページ ID（例: `14305`, `12952`）は連番ではなく、CMS の内部 ID のため規則性がない
- 全 PDF が `/material/files/group/30/` ディレクトリ配下に格納されている（議会総務課のグループ ID = 30）
- リクエスト間には適切な待機時間（1〜2秒）を設けること

---

## 推奨アプローチ

1. **一覧ページからの全量収集**: トップページ → 各年度ページ → PDF リンクの順にクロールし、全 PDF の URL とメタ情報を収集する
2. **リンクテキストからのメタ情報取得**: PDF ファイル名ではなく、HTML ページ上のリンクテキストから会議種別・日付を取得する
3. **PDF テキスト抽出**: ダウンロードした PDF からテキストを抽出し、発言者・発言内容を構造化する
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2秒）を設ける
5. **差分更新**: 各年度ページの PDF リンク一覧を取得し、既取得済みの URL と比較して新規分のみダウンロードする
