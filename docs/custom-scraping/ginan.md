# 岐南町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.ginan.lg.jp/3638.htm
- 分類: 会議録検索システムなし・年別 PDF 直接公開
- 文字コード: UTF-8
- 特記: 会議録検索システムは導入していない。公式サイト上で年別に会議録 PDF を公開しており、2021年（令和3年）第3回定例会分から公開。オンライン検索機能はなく、PDF ファイルへの直接アクセスのみ。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.town.ginan.lg.jp/3638.htm` |
| 年別一覧 | `https://www.town.ginan.lg.jp/{ページID}.htm` |
| 定例会別詳細 | `https://www.town.ginan.lg.jp/{ページID}.htm` |
| PDF（会議録本文） | `https://www.town.ginan.lg.jp/secure/{セッションID}/{ファイル名}.pdf` |

### 年別一覧ページの対応表

| 年 | URL |
| --- | --- |
| 2025年（令和7年） | `https://www.town.ginan.lg.jp/5439.htm` |
| 2024年（令和6年） | `https://www.town.ginan.lg.jp/5035.htm` |
| 2023年（令和5年） | `https://www.town.ginan.lg.jp/5036.htm` |
| 2022年（令和4年） | `https://www.town.ginan.lg.jp/5037.htm` |
| 2021年（令和3年） | `https://www.town.ginan.lg.jp/5038.htm` |

---

## ページ構造

### 年別一覧ページ

各年のページには定例会の一覧がリスト形式で掲載されている。会議ごとに詳細ページへのリンクがある。

**リンクテキスト形式:**
```
第{X}回定例会({月})会議録
```

例:
```
第1回定例会(3月)会議録  → /5440.htm
第2回定例会(6月)会議録  → /5566.htm
第3回定例会(10月)会議録 → /5683.htm
第4回定例会(12月)会議録 → /5801.htm
```

### 定例会詳細ページ

各定例会の詳細ページには、目次 PDF と日別会議録 PDF へのリンクが掲載されている。

**リンクテキスト形式:**
```
〇第{X}回定例会(第{号数}号){元号}{年}年{月}日({サイズ}KB)
```

例:
```
〇第4回定例会(第1号)令和7年11月28日(136KB)
〇第4回定例会(第2号)令和7年12月3日(191KB)
〇第4回定例会(第3号)令和7年12月18日(452KB)
```

---

## PDF URL パターン

PDF は `/secure/{セッションID}/{ファイル名}.pdf` の形式で公開されている。セッション ID は定例会ごとに固有の数値。

**ファイル名の命名規則:**

| 種類 | パターン | 例 |
| --- | --- | --- |
| 目次（新形式） | `YYMMmokuji.pdf` | `2512mokuji.pdf`（令和7年12月） |
| 目次（旧形式） | `mokuji.pdf` | `mokuji.pdf` |
| 会議録（日付形式） | `YYMMDD.pdf` | `251203.pdf`（令和7年12月3日） |
| 会議録（連番形式） | `teirei{N}.pdf` | `teirei1.pdf`, `teirei2.pdf` |

※ 2021年（令和3年）第3回定例会は連番形式（`teirei1.pdf`〜）、第4回以降は日付形式（`YYMMDD.pdf`）に移行している。

### PDF URL 例

```
# 2025年（令和7年）第4回定例会
https://www.town.ginan.lg.jp/secure/7528/2512mokuji.pdf
https://www.town.ginan.lg.jp/secure/7528/251128.pdf
https://www.town.ginan.lg.jp/secure/7528/251203.pdf

# 2025年（令和7年）第1回定例会
https://www.town.ginan.lg.jp/secure/7148/2503mokuji.pdf
https://www.town.ginan.lg.jp/secure/7148/250228.pdf
https://www.town.ginan.lg.jp/secure/7148/250303.pdf

# 2024年（令和6年）第1回定例会
https://www.town.ginan.lg.jp/secure/6397/2403mokuji.pdf
https://www.town.ginan.lg.jp/secure/6397/240301.pdf

# 2021年（令和3年）第3回定例会（連番形式）
https://www.town.ginan.lg.jp/secure/4400/mokuji.pdf
https://www.town.ginan.lg.jp/secure/4400/teirei1.pdf
https://www.town.ginan.lg.jp/secure/4400/teirei2.pdf

# 2021年（令和3年）第4回定例会（日付形式に移行）
https://www.town.ginan.lg.jp/secure/4514/mokuji.pdf
https://www.town.ginan.lg.jp/secure/4514/211130.pdf
https://www.town.ginan.lg.jp/secure/4514/211206.pdf
```

---

## 公開範囲

- **開始**: 2021年（令和3年）第3回定例会（10月開催分）
- **会議種別**: 定例会のみ（臨時会の会議録は非公開またはなし）
- **開催回数**: 年4回（3月・6月・9月または10月・12月）
- **各定例会の構成**: 複数日にまたがる複数号（4〜5号程度）の PDF

---

## スクレイピング戦略

### Step 1: 年別一覧ページから定例会リンクを収集

会議録トップページ `https://www.town.ginan.lg.jp/3638.htm` から年別ページのリンクを取得する。

- 各年別ページ（`/5439.htm` 等）にアクセスし、定例会ページへのリンク一覧を取得する
- リンクテキストが `第{X}回定例会({月})会議録` の形式に一致するものを抽出する

### Step 2: 定例会詳細ページから PDF リンクを収集

各定例会ページにアクセスし、PDF へのリンクを抽出する。

- `/secure/` で始まる `.pdf` へのリンクを全件抽出する
- 目次 PDF（`mokuji.pdf`）と会議録 PDF（日付形式または連番形式）を区別する
- リンクテキストから号数・日付・ファイルサイズを抽出する

**リンク抽出例（Cheerio）:**
```typescript
// PDF リンクを全件取得
const pdfLinks = $("a[href$='.pdf']")
  .toArray()
  .map((el) => ({
    href: $(el).attr("href")!,
    text: $(el).text().trim(),
  }))
  .filter(({ href }) => href.includes("/secure/"));

// 会議録メタ情報の抽出（目次を除く）
const sessionPattern = /〇第(\d+)回定例会\(第(\d+)号\)(?:令和|平成)(\d+)年(\d+)月(\d+)日/;
```

### Step 3: PDF の取得とテキスト抽出

- PDF ファイルを直接ダウンロードし、テキスト抽出処理を行う
- 各号の PDF はそれぞれ独立した開催日の会議録
- 目次 PDF はスキップする

---

## 注意事項

- セッション ID（`/secure/{ID}/`）は定例会ごとに異なり、URL から推測できない。必ず詳細ページのリンクから取得すること
- ファイル名の命名規則が 2021年第3回（連番形式）と第4回以降（日付形式）で異なるため、詳細ページのリンクを逐次取得するアプローチが確実
- ページネーションはなく、1ページに全会議録 PDF リンクが掲載される
- 年別一覧ページの URL は年ごとに固定されているが、将来年が追加された場合は新規ページ ID が割り当てられるため、トップページから動的にリンクを取得するのが望ましい
- レート制限: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **トップページ起点でクロール**: `3638.htm` → 年別ページ → 定例会詳細ページ → PDF の順でリンクを辿る
2. **PDF リンクを詳細ページから取得**: セッション ID が定例会ごとに異なるため、PDF URL を直接予測せず必ず詳細ページから取得する
3. **目次 PDF をスキップ**: `mokuji.pdf` や `YYMMmokuji.pdf` は会議録本文ではないため除外する
4. **差分更新**: 年別一覧ページを定期的にチェックし、新規定例会ページが追加されたら処理対象に加える
