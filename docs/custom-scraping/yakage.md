# 矢掛町議会 カスタムスクレイピング方針

## 概要

- サイト: http://www.town.yakage.okayama.jp/gikaikaigiroku.html
- 分類: 静的 HTML ページに PDF リンクを一覧掲載（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式のみで公開。検索機能なし。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧 | `http://www.town.yakage.okayama.jp/gikaikaigiroku.html` |
| PDF ファイル（主要） | `http://www.town.yakage.okayama.jp/files/{ファイル名}.pdf` |
| PDF ファイル（一部） | `http://www.town.yakage.okayama.jp/parts/files/{ファイル名}.pdf` |

- 一覧ページは 1 ページのみ（ページネーションなし）
- すべての PDF リンクが単一ページに掲載されている

---

## PDF ファイル名の命名規則

ファイル名に統一的な命名規則はなく、以下のようなバリエーションがある:

| パターン | 例 |
| --- | --- |
| `{YYYYMM}gikaikaigiroku.pdf` | `201609gikaikaigiroku.pdf`, `201706gikaikaigiroku.pdf` |
| `{YYYYMM}gikairoku.pdf` | `201703gikairoku.pdf`, `201812gikairoku.pdf` |
| `{YYYYMM}kaigiroku{M}.pdf` | `201911kaigiroku9.pdf`, `202002kaigiroku12.pdf` |
| `{YYYYMM}gikai_gijiroku{M}.pdf` | `202006gikai_gijiroku3.pdf` |
| `{YYYYMM}gikaigiji.pdf` | `202202gikaigiji.pdf` |
| `{YYYYMM}giji.pdf` | `202212giji.pdf` |
| `h{YY}teireigikaikaigiroku.pdf` | `h30teireigikaikaigiroku.pdf` |
| `{YYYYMM}rinjigikairoku.pdf` | `202304rinjigikairoku.pdf` |

※ 一部に `.pdf.pdf` という二重拡張子のファイルも存在する（`202007gikai_gijiroku456.pdf.pdf`）。

---

## 掲載されている会議録の範囲

- 最古: 平成28年（2016年）9月定例議会
- 最新: 令和5年（2023年）第1回定例会・第2回臨時会（確認時点）
- 会議種別: 定例議会（定例会）、臨時議会（臨時会）
- 令和3年以降は「第N回議会第N回定例会」のような通し番号方式の命名に変更されている

---

## 会議の種類

リンクテキストから確認できる会議種別:

- 定例議会（3月、6月、9月、12月）
- 臨時議会
- 令和3年以降: 「第N回議会第N回定例会」「第N回議会第N回臨時会」

※ 複数の会議が 1 つの PDF にまとめられているケースがある（例: 「9月定例議会・10月臨時議会会議録」）。

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

一覧ページ `http://www.town.yakage.okayama.jp/gikaikaigiroku.html` から全 PDF リンクを抽出する。

- ページは 1 ページのみ（ページネーションなし）
- PDF リンクは `<p class="link01">` 内の `<a>` タグに含まれる
- リンクテキストに会議名・開催時期・ファイルサイズが記載されている

**収集方法:**

1. 一覧ページを取得
2. `<p class="link01">` 内の `<a href="...pdf">` を Cheerio で抽出
3. リンクテキストから会議名と開催時期をパース

### Step 2: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF パーサー（`pdf-parse` 等）を使用してテキストを抽出
- PDF の構造は会議録の全文が含まれる（1 ファイルに複数日分の会議録が含まれる場合あり）

### Step 3: 会議録のパース

#### メタ情報

リンクテキストから以下を抽出:

```
平成28年9月定例議会会議録（PDF:1159KB）
令和5年第1回矢掛町議会第1回定例会・第2回矢掛町議会第1回臨時会（PDF:3.07MB）
```

- 開催年: 和暦（平成/令和）+ 年
- 会議種別: 定例議会/臨時議会、または第N回定例会/第N回臨時会
- 開催月: リンクテキストまたはファイル名から推定

#### パース用正規表現（案）

```typescript
// リンクテキストから会議情報を抽出
const sessionPattern = /^(平成|令和)(\d+)年(.+?)会議録/;
// 例: 平成28年9月定例議会会議録 → era="平成", year="28", session="9月定例議会"

// ファイルサイズの除去
const fileSizePattern = /（PDF[:：].+?）$/;
```

#### PDF 内の発言構造

PDF から抽出したテキストの発言者パターンは、PDF の内容を実際に確認して決定する必要がある。一般的な町議会会議録のパターンとして以下が想定される:

```typescript
// 発言者の抽出（要実データ確認）
const speakerPattern = /^○(.+?)(?:（(.+?)）)?/;
// または
const speakerPattern2 = /^◎(.+?)(?:（(.+?)）)?/;
```

---

## 注意事項

- HTTP のみ（HTTPS 非対応）: TLS 証明書のホスト名不一致により HTTPS ではアクセスできない
- PDF ファイル名に統一規則がないため、リンクの href 属性から直接 URL を取得する必要がある
- 複数の会議が 1 つの PDF にまとめられているケースがあり、PDF 内で会議の境界を検出する必要がある
- 一部ファイルに二重拡張子（`.pdf.pdf`）がある
- PDF 内のテキスト抽出精度は PDF の作成方法に依存する（スキャン画像の場合は OCR が必要になる可能性あり）

---

## 推奨アプローチ

1. **一覧ページから全リンクを取得**: 単一ページに全 PDF リンクが集約されているため、1 回のリクエストで全量把握が可能
2. **PDF ダウンロード + テキスト抽出**: `pdf-parse` 等のライブラリで PDF からテキストを抽出
3. **レート制限**: 自治体サイトのため、PDF ダウンロード間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 一覧ページの PDF リンク数を前回と比較し、新規追加分のみダウンロードする
5. **PDF 内容の事前調査**: 実装前に数件の PDF を手動でダウンロードし、テキスト抽出の品質と発言者パターンを確認する
