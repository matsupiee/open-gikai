# 紀北町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.mie-kihoku.lg.jp/kakuka/gikai/kaigiroku/index.html
- 分類: WordPress による HTML 公開（標準的な会議録検索システムは不使用）
- 文字コード: UTF-8
- 特記: 年度ごとにカテゴリページを設け、各年度ページ（WordPress 投稿）に PDF リンクを列挙する構成。発言者情報は PDF 内にのみ存在し、HTML には含まれない。

---

## URL 構造

### カテゴリ階層

| ページ | URL |
| --- | --- |
| 会議録トップ | `https://www.town.mie-kihoku.lg.jp/kakuka/gikai/kaigiroku/index.html` |
| 令和7年 | `https://www.town.mie-kihoku.lg.jp/category/gikaijimu/%e4%bc%9a%e8%ad%b0%e9%8c%b2/%e4%bb%a4%e5%92%8c7%e5%b9%b4%e4%bc%9a%e8%ad%b0%e9%8c%b2/` |
| 令和6年 | `https://www.town.mie-kihoku.lg.jp/category/gikaijimu/%e4%bc%9a%e8%ad%b0%e9%8c%b2/%e4%bb%a4%e5%92%8c6%e5%b9%b4%e4%bc%9a%e8%ad%b0%e9%8c%b2/` |
| 令和5年 | `https://www.town.mie-kihoku.lg.jp/category/gikaijimu/%e4%bc%9a%e8%ad%b0%e9%8c%b2/%e4%bb%a4%e5%92%8c5%e5%b9%b4%e4%bc%9a%e8%ad%b0%e9%8c%b2/` |
| 令和4年 | `https://www.town.mie-kihoku.lg.jp/category/gikaijimu/%e4%bc%9a%e8%ad%b0%e9%8c%b2/%e4%bb%a4%e5%92%8c4%e5%b9%b4%e4%bc%9a%e8%ad%b0%e9%8c%b2/` |
| 過年分（令和3年〜平成17年） | `https://www.town.mie-kihoku.lg.jp/category/gikaijimu/%e4%bc%9a%e8%ad%b0%e9%8c%b2/%e9%81%8e%e5%b9%b4%e5%88%86/` |

### 各年度の投稿 URL（ハードコード推奨）

各カテゴリページには 1 件の WordPress 投稿へのリンクが含まれる（1年度 = 1投稿）。

| 年度 | 投稿 URL |
| --- | --- |
| 令和7年 | `https://www.town.mie-kihoku.lg.jp/2025/06/12/8857/` |
| 令和6年 | `https://www.town.mie-kihoku.lg.jp/2024/07/12/570/` |
| 令和5年 | `https://www.town.mie-kihoku.lg.jp/2024/04/09/568/` |
| 令和3年 | `https://www.town.mie-kihoku.lg.jp/2022/08/19/536/` |
| 令和2年 | `https://www.town.mie-kihoku.lg.jp/2022/08/19/540/` |
| 平成31年・令和元年 | `https://www.town.mie-kihoku.lg.jp/2022/08/19/538/` |
| 平成30年 | `https://www.town.mie-kihoku.lg.jp/2022/08/19/532/` |
| 平成29年 | `https://www.town.mie-kihoku.lg.jp/2022/08/19/542/` |
| 平成28年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/544/` |
| 平成27年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/546/` |
| 平成26年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/548/` |
| 平成25年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/550/` |
| 平成24年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/552/` |
| 平成23年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/554/` |
| 平成22年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/556/` |
| 平成21年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/558/` |
| 平成20年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/560/` |
| 平成19年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/562/` |
| 平成18年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/564/` |
| 平成17年 | `https://www.town.mie-kihoku.lg.jp/2022/12/20/566/` |

※ 令和4年の投稿 URL は令和5年カテゴリページと同一エントリに含まれる可能性があるため、令和4年カテゴリページを別途確認すること。

---

## 会議録の形式

- **すべて PDF**（HTML 形式の会議録は存在しない）
- PDF は 2 種類のパスに分散している:
  - `/assets25/pdf/[ファイル名].pdf`（令和4〜6年頃のメイン）
  - `/wp-content/uploads/YYYY/MM/[ハッシュ値].pdf`（新旧問わず混在）
- ファイル名に規則性はなく、URL から会議名・日付を推定することは困難

---

## 会議構成

各年度の投稿ページに以下のリンクが含まれる（定例会・臨時会の別に列挙）。

| 会議種別 | 年間開催数の目安 |
| --- | --- |
| 定例会（3月・6月・9月・12月） | 年4回 |
| 臨時会 | 年1〜6回程度（年により異なる） |

各定例会は複数の PDF に分かれており、以下の単位で公開されている。

| 文書種別 | 内容 |
| --- | --- |
| 開会・提案説明・質疑・委員会付託 | 本会議録（1日目） |
| 一般質問（1日目） | 本会議録 |
| 一般質問（2日目） | 本会議録 |
| 委員長報告・採決・閉会 | 本会議録（最終日） |
| 会期日程 | 参考資料 |
| 議事日程 | 参考資料 |
| 応招・不応招 | 参考資料（出欠記録） |

---

## ページネーション

- カテゴリページ・投稿ページともにページネーションなし
- 1 年度 = 1 投稿ページにすべての PDF リンクが掲載されている

---

## 発言者情報

- 発言者情報は **PDF 内にのみ存在**する
- HTML ページには発言者の名前・役職は含まれない
- PDF 内の発言者表記は通常の議事録形式（「○○番（氏名）」等）と推定されるが、PDF テキスト抽出が必要

---

## スクレイピング戦略

### Step 1: 年度別投稿 URL の収集

上記の投稿 URL 一覧をハードコードして使用する（動的収集も可能だが安定性優先）。

動的に収集する場合は以下の手順:

1. 令和4年以降は個別年度カテゴリページから 1 件の記事リンクを取得
2. 令和3年以前は「過年分」カテゴリページに全年度分のリンクがまとまっている

### Step 2: 各年度投稿ページからの PDF リンク収集

各投稿ページ（`/YYYY/MM/DD/{ID}/` 形式）を取得し、`.pdf` へのリンクを全件抽出する。

```typescript
// Cheerio での PDF リンク抽出例
const pdfLinks = $("a[href$='.pdf']")
  .map((_, el) => ({
    text: $(el).text().trim(),
    url: $(el).attr("href"),
  }))
  .get();
```

- リンクテキスト（`<a>` タグの内側テキスト）が会議名・会議種別・開催日の手がかりになる
- リンクテキストの例:
  - `「令和6年第1回臨時会」`
  - `「3月定例会（開会・提案説明・質疑・委員会付託）」`
  - `「一般質問1日目」`
  - `「会期日程」`（参考資料のため除外対象）

### Step 3: PDF からのテキスト抽出

PDF テキストを抽出して議事録本文・発言者情報を取得する。

- `pdf-parse` 等のライブラリを使用
- 発言者パターン・開催日・会議名はテキスト抽出後に正規表現でパース

---

## 注意事項

- PDF ファイル名に命名規則が統一されていないため、ファイル名からメタ情報を得ることはできない
- `/assets25/pdf/` と `/wp-content/uploads/` の 2 つのパスが混在しており、どちらにも `.pdf` リンクが存在する
- 令和7年のページは年度末まで追記が続く（2025年9月定例会まで確認済み）
- 会期日程・議事日程・応招不応招などの「参考資料」 PDF はスクレイピング対象外でよい（会議録本文ではないため）
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **URL 一覧をハードコード**: 年度別投稿 URL は変動しないためハードコードが安全。新年度追加時はカテゴリページを確認して追記する。
2. **リンクテキストをメタ情報として活用**: PDF URL よりもリンクテキストの方が会議名・日付の情報が豊富なため、`{text, url}` のペアで収集する。
3. **参考資料 PDF の除外**: 「会期日程」「議事日程」「応招」「不応招」を含むリンクテキストのものは会議録本文でないためスキップする。
4. **PDF テキスト抽出での発言者取得**: HTML レベルでは発言者情報が得られないため、PDF のテキスト抽出が必須。
