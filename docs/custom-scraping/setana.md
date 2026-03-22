# せたな町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.setana.lg.jp/gikai/kaigiroku/
- 分類: 年度別アーカイブ形式、PDF ダウンロード（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 対象期間: 令和7年（2025）〜平成26年（2014）

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.town.setana.lg.jp/gikai/kaigiroku/` |
| 令和4〜7年 | `https://www.town.setana.lg.jp/gikai/kaigiroku/R{年}/` |
| 令和2〜3年 | `https://www.town.setana.lg.jp/gikai/kaigiroku/{年度番号}/` (例: `210/`, `31/`) |
| 平成28〜31年 | `https://www.town.setana.lg.jp/gikai/kaigiroku/{年度番号}/` (例: `30/`, `29/`) |
| 平成26〜27年 | `https://www.town.setana.lg.jp/gikai/kaigiroku/h{年度}kaigiroku/` |

### 年度別ページ URL 一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `/gikai/kaigiroku/R7/` |
| 令和6年 | `/gikai/kaigiroku/R6/` |
| 令和5年 | `/gikai/kaigiroku/R5/` |
| 令和4年 | `/gikai/kaigiroku/R4/` |
| 令和3年 | `/gikai/kaigiroku/R3/` |
| 令和2年 | `/gikai/kaigiroku/210/` |
| 平成31年 | `/gikai/kaigiroku/31/` |
| 平成30年 | `/gikai/kaigiroku/30/` |
| 平成29年 | `/gikai/kaigiroku/29/` |
| 平成28年 | `/gikai/kaigiroku/h28kaigiroku/` |
| 平成27年 | `/gikai/kaigiroku/h27kaigiroku/` |
| 平成26年 | `/gikai/kaigiroku/h26kaigiroku/` |

---

## 会議の種類

| 種別 | 頻度 |
| --- | --- |
| 定例会 | 年3〜4回 |
| 臨時会 | 年6〜8回程度 |
| 予算審査特別委員会 | 年1回 |
| 決算審査特別委員会 | 年1回 |

---

## PDF ファイルの URL パターン

年度・時期によって複数の URL パターンが混在している。

### パターン 1: ハッシュ値ファイル名（`/gikai/` 直下）

```
https://www.town.setana.lg.jp/gikai/{ハッシュ}.pdf
例: /gikai/9942fc9f65c79472fda6d56e08c22771.pdf
```

### パターン 2: 年ディレクトリ + ハッシュ値

```
https://www.town.setana.lg.jp/gikai/{年}/{ハッシュ}.pdf
例: /gikai/2025/8bfd5b1e0658744d7e26f37b168e6884.pdf
例: /gikai/2024/a4545f7d6069d0b444451f796bfb8964.pdf
```

### パターン 3: uploads/photos + 日本語ファイル名

```
https://www.town.setana.lg.jp/gikai/uploads/photos/{日本語ファイル名}.pdf
例: /gikai/uploads/photos/第1回定例会（3月4日～22日）.pdf（URL エンコード済み）
```

### パターン 4: uploads/documents + 数値 ID

```
https://www.town.setana.lg.jp/uploads/documents/{数値ID}.pdf
例: /uploads/documents/353569.pdf
```

### パターン 5: files/ + ハッシュ値

```
https://www.town.setana.lg.jp/gikai/files/{ハッシュ}.pdf
例: /gikai/files/11dcbf24c95db1269886c53ba281d016.pdf
```

---

## HTML 構造

各年度ページの会議録一覧は `<ul>` / `<li>` のリスト形式で構成されている。テーブル形式ではない。

```
定例会
  ├── 第1回定例会（開催日） → PDF リンク
  ├── 第2回定例会（開催日） → PDF リンク
  └── ...
臨時会
  ├── 第1回臨時会（開催日） → PDF リンク
  └── ...
予算審査特別委員会
  └── PDF リンク
決算審査特別委員会
  └── PDF リンク
```

- 会議種別（定例会・臨時会・特別委員会）は見出しまたはテキストで区別
- 各会議録は PDF ファイルへの直接リンク
- ページネーションは無し（各年度ページに全件表示）

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の列挙

トップページ `/gikai/kaigiroku/` から各年度ページへのリンクを収集する。

- 年度ページの URL パターンは統一されていないため、トップページのリンクを動的に取得する
- 全 12 年度分（令和7年〜平成26年）

### Step 2: 各年度ページから PDF リンクの収集

各年度ページの HTML をパースし、PDF ファイルへのリンクをすべて抽出する。

**収集方法:**

1. 各年度ページの HTML を取得
2. `<a>` タグの `href` 属性から `.pdf` で終わるリンクを抽出
3. 相対パスの場合はベース URL と結合して絶対 URL に変換
4. リンクテキストから会議種別・回次・開催日をメタ情報として抽出

**メタ情報の抽出（リンクテキストから）:**

```typescript
// リンクテキスト例: "第１回定例会（3月4日～22日）"
const meetingPattern = /第[１-９\d]+回(定例会|臨時会)/;
const datePattern = /(\d+)月(\d+)日/;
```

### Step 3: PDF のダウンロードとテキスト抽出

1. 収集した PDF URL からファイルをダウンロード
2. PDF パーサー（pdf-parse 等）でテキストを抽出
3. 抽出したテキストから発言者・発言内容をパース

### Step 4: 会議録のパース

#### メタ情報

年度ページのリンクテキストおよび PDF 内のヘッダーから以下を抽出:

- 会議種別（定例会 / 臨時会 / 特別委員会）
- 回次（第1回、第2回 ...）
- 開催日
- 年度

#### 発言の構造

PDF から抽出したテキストの発言者パターンは PDF の内容に依存するため、実際の PDF を取得して確認が必要。

---

## 注意事項

- PDF の URL パターンが年度によって大きく異なる（5 種類のパターンが混在）
- 一部の PDF は日本語ファイル名のため URL エンコードが必要
- PDF 内のテキスト構造は実際にダウンロードして確認する必要がある
- 会議録はすべて PDF 形式であり、HTML の会議録本文は提供されていない
- ページネーションは無く、各年度ページに全会議録が一覧表示される

---

## 推奨アプローチ

1. **トップページ起点でクロール**: URL パターンが年度ごとに異なるため、トップページから動的にリンクを辿る
2. **PDF 直接取得**: HTML の本文ページが無いため、PDF をダウンロードしてテキスト抽出する方式を採用
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 年度ページ単位で管理し、最新年度のページのみを再クロールして新規 PDF を検出する
5. **URL パターンの多様性に対応**: `.pdf` 拡張子でのリンク抽出を基本とし、特定のパスパターンに依存しない実装にする
