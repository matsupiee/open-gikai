# 高取町議会（奈良県）カスタムスクレイピング方針

## 概要

- サイト: https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-0-0
- 分類: 独自 PHP システム（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 提供形式: PDF（テキスト埋め込み済み、OCR 不要）
- 掲載期間: 令和 3 年（2021 年）〜令和 8 年（2026 年）
- 特記: Google Analytics / Google Tag Manager 使用

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-0-0` |
| 年度別会議一覧 | `https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-{年度コード}-0` |
| 会議詳細（PDF リンク一覧） | `https://www.town.takatori.nara.jp/contents_detail.php?co=cat&frmId={frmId}&frmCd=1-1-5-{年度コード}-0` |
| PDF ファイル | `https://www.town.takatori.nara.jp/cmsfiles/contents/{dirId}/{frmId}/{ファイル名}.pdf` |

### frmCd の年度コード対応表

| 年度 | 年度コード | frmCd |
| --- | --- | --- |
| 令和 8 年 | 6 | `1-1-5-6-0` |
| 令和 7 年 | 5 | `1-1-5-5-0` |
| 令和 6 年 | 4 | `1-1-5-4-0` |
| 令和 5 年 | 3 | `1-1-5-3-0` |
| 令和 4 年 | 2 | `1-1-5-2-0` |
| 令和 3 年 | 1 | `1-1-5-1-0` |

---

## 会議録一覧（全件）

トップページ（`frmCd=1-1-5-0-0`）に全年度の会議一覧が一括で掲載されている。各会議は `contents_detail.php` へのリンクで提供される。

| 年度 | 会議名 | frmId | frmCd | PDF ファイル名 | 開催日 |
| --- | --- | --- | --- | --- | --- |
| 令和 7 年 | 第 4 回定例会 | 2539 | 1-1-5-5-0 | `1.pdf` | 2026 年 2 月 24 日 |
| 令和 7 年 | 第 3 回定例会 | 2527 | 1-1-5-5-0 | `1.pdf` | 2025 年 12 月 16 日 |
| 令和 7 年 | 第 2 回定例会 | 2463 | 1-1-5-5-0 | `1.pdf` | 2025 年 9 月 2 日 |
| 令和 7 年 | 第 1 回定例会 | 2419 | 1-1-5-5-0 | `1.pdf` | 2025 年 6 月 12 日 |
| 令和 6 年 | 第 4 回定例会 | 2338 | 1-1-5-4-0 | `1.pdf` | 2025 年 3 月 7 日 |
| 令和 6 年 | 第 3 回定例会 | 2294 | 1-1-5-4-0 | `1.pdf` | 2024 年 11 月 19 日 |
| 令和 6 年 | 第 2 回定例会 | 2204 | 1-1-5-4-0 | `1.pdf` | 2024 年 8 月 23 日 |
| 令和 6 年 | 第 1 回定例会 | 2111 | 1-1-5-4-0 | `1.pdf` | 2024 年 5 月 31 日 |
| 令和 5 年 | 第 4 回定例会 | 2042 | 1-1-5-3-0 | `1.pdf` | 2024 年 2 月 27 日 |
| 令和 5 年 | 第 3 回定例会 | 1959 | 1-1-5-3-0 | `1.pdf` | 2023 年 12 月 1 日 |
| 令和 5 年 | 第 2 回定例会 | 1888 | 1-1-5-3-0 | `1.pdf` | 2023 年 8 月 4 日 |
| 令和 5 年 | 第 1 回定例会 | 1796 | 1-1-5-3-0 | `1.pdf` | 2023 年 5 月 8 日 |
| 令和 5 年 | ワクチン接種調査特別委員会 | 1743 | 1-1-5-3-0 | `10.pdf` | 2023 年 5 月 12 日 |
| 令和 4 年 | 第 2 回定例会 | 1518 | 1-1-5-2-0 | `2.pdf` | 2022 年 7 月 25 日 |
| 令和 4 年 | 第 1 回定例会 | 1453 | 1-1-5-2-0 | `1.pdf` | 2022 年 8 月 5 日 |
| 令和 3 年 | 第 4 回定例会 | 1377 | 1-1-5-1-0 | `1.pdf` | 2022 年 12 月 1 日 |
| 令和 3 年 | ワクチン接種調査特別委員会 | 1295 | 1-1-5-1-0 | `1.pdf`〜`3.pdf` | 2022 年 8 月 5 日 |
| 令和 3 年 | 第 3 回定例会（100 条調査含む） | 1289 | 1-1-5-1-0 | `9.13.pdf`〜`11.15.pdf` | 2022 年 6 月 23 日 |

---

## PDF ファイルの特性

- テキスト埋め込み済み（OCR 不要）
- フォント: MS-Mincho / Yu Mincho（本文）、Century（英数字）
- エンコーディング: Identity-H（日本語 Unicode）+ WinAnsiEncoding（英数字）
- ページ数: 定例会は 70〜140 ページ程度
- 言語設定: `ja-JP`

### PDF URL パターン

`dirId`（`cmsfiles/contents/` 以下のディレクトリ番号）は frmId によって異なる。

```
https://www.town.takatori.nara.jp/cmsfiles/contents/{dirId}/{frmId}/{ファイル名}.pdf
```

確認されている `dirId` の例:

| frmId の範囲（目安） | dirId |
| --- | --- |
| 1289〜1795 | `0000001` |
| 1796〜2539 | `0000002` |

`dirId` の正確な値は各 `contents_detail.php` ページのリンクを解析して取得する必要がある。

### PDF ファイル名のパターン

会議によってファイル名の命名規則が異なる。

| 会議種別 | ファイル名の例 | 備考 |
| --- | --- | --- |
| 定例会（通常） | `1.pdf`, `2.pdf` | 連番、1 ファイルが一般的 |
| 調査特別委員会（複数回） | `1.pdf`, `2.pdf`, `3.pdf` | 回次別に連番 |
| 定例会（複数日程） | `9.13.pdf`, `9.21.pdf`, `10.5.pdf` | 月.日 形式 |

---

## スクレイピング戦略

### Step 1: 会議一覧ページから frmId と PDF リンクを収集

トップページ（`frmCd=1-1-5-0-0`）に全年度の会議リンクが掲載されているため、1 ページのアクセスで全 `frmId` を取得できる。

```
1. https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-0-0 を取得
2. a[href*="contents_detail.php"] を Cheerio で抽出
3. href から frmId と frmCd を正規表現で取得
4. リンクテキスト（会議名）も抽出
```

#### Cheerio によるリンク抽出（案）

```typescript
// 全会議リンクを抽出
const links = $("a[href*='contents_detail.php']");
links.each((_, el) => {
  const href = $(el).attr("href") ?? "";
  const label = $(el).text().trim(); // 例: "第4回定例会"
  const frmIdMatch = href.match(/frmId=(\d+)/);
  const frmCdMatch = href.match(/frmCd=([\d-]+)/);
  const frmId = frmIdMatch?.[1];
  const frmCd = frmCdMatch?.[1];
});
```

### Step 2: 各会議の詳細ページから PDF リンクを収集

各 `contents_detail.php` ページにアクセスし、PDF リンクを抽出する。

```typescript
// PDF リンクを抽出
const pdfLinks = $("a[href$='.pdf'], a[href*='.pdf']");
pdfLinks.each((_, el) => {
  const href = $(el).attr("href") ?? "";
  const label = $(el).text().trim(); // 例: "本会議　12月8日"
  // 相対 URL を絶対 URL に変換
  const pdfUrl = new URL(href, "https://www.town.takatori.nara.jp/contents_detail.php").href;
});
```

### Step 3: PDF のダウンロードとテキスト抽出

PDF はテキスト埋め込み済みのため、`pdf-parse` 等のライブラリで直接テキスト抽出が可能。

```typescript
import pdfParse from "pdf-parse";

const response = await fetch(pdfUrl);
const buffer = await response.arrayBuffer();
const data = await pdfParse(Buffer.from(buffer));
const text = data.text;
```

### Step 4: メタ情報のパース

- 会議名はトップページのリンクテキストから取得（例: `第4回定例会`）
- 開催日は詳細ページのリンクテキストから取得（例: `本会議　12月8日`）
- 年度は `frmCd` の年度コードから対応付ける

```typescript
// frmCd から年度（令和）を取得
const yearCodeMatch = frmCd.match(/1-1-5-(\d+)-0/);
const reiwaYear = parseInt(yearCodeMatch?.[1] ?? "0", 10);
// 令和 → 西暦: 2018 + reiwaYear
const year = 2018 + reiwaYear;
```

---

## 注意事項

- PDF の `dirId`（`0000001` / `0000002`）は frmId の範囲によって変わるため、`contents_detail.php` のリンクから直接取得する必要がある（固定値を仮定しない）
- 一つの会議に複数の PDF が添付される場合がある（特に調査特別委員会や複数日程の定例会）
- PDF ファイル名は連番（`1.pdf`, `2.pdf`, ...）または月日形式（`9.13.pdf`, `10.5.pdf`, ...）のいずれかで、会議によって異なる
- 令和 3 年第 3 回定例会（frmId=1289）は 100 条調査委員会を含み、8 ファイルに分割されている
- トップページには全年度分が一覧表示されるため、年度別ページを個別に巡回する必要はない
- 令和 4 年は 2 件のみ掲載（令和 4 年の第 3・第 4 回定例会は未掲載の可能性あり）

---

## 推奨アプローチ

1. **全量取得を優先**: トップページ 1 件のアクセスで全 `frmId` が取得可能なため、効率的にクロール対象を収集する
2. **詳細ページから PDF リンクを確実に取得**: PDF 数や命名規則が会議ごとに異なるため、`contents_detail.php` を必ず経由して PDF URL を収集する（URL を推測しない）
3. **PDF テキスト抽出**: テキスト埋め込み済みのため OCR 不要。`pdf-parse` を使用
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **新規会議の検出**: トップページを定期的に再取得し、新しい `frmId` が追加された場合のみ差分取得する
