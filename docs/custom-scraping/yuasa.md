# 湯浅町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.yuasa.wakayama.jp/site/gikai/
- 自治体コード: 303615
- 分類: 年度別 PDF 公開（専用検索システムなし）
- 文字コード: UTF-8
- 特記: 汎用 CMS（自治体向け）を使用。定例会・臨時会が別カテゴリで管理されており、各会議ページに複数の PDF が掲載される

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.town.yuasa.wakayama.jp/site/gikai/` |
| 定例会 年度別一覧 | `https://www.town.yuasa.wakayama.jp/site/gikai/list47-{ID}.html` |
| 臨時会 年度別一覧 | `https://www.town.yuasa.wakayama.jp/site/gikai/list48-{ID}.html` |
| 会議詳細 | `https://www.town.yuasa.wakayama.jp/site/gikai/{ID}.html` |
| PDF ファイル | `https://www.town.yuasa.wakayama.jp/uploaded/attachment/{ID}.pdf` |

---

## 年度別一覧の ID

### 定例会（カテゴリ 47）

| 年度 | URL |
| --- | --- |
| 令和8年 | `/site/gikai/list47-407.html` |
| 令和7年 | `/site/gikai/list47-357.html` |
| 令和6年 | `/site/gikai/list47-341.html` |
| 令和5年 | `/site/gikai/list47-312.html` |
| 令和4年 | `/site/gikai/list47-98.html` |

### 臨時会（カテゴリ 48）

| 年度 | URL |
| --- | --- |
| 令和7年 | `/site/gikai/list48-358.html` |
| 令和6年 | `/site/gikai/list48-340.html` |
| 令和5年 | `/site/gikai/list48-316.html` |

---

## 会議種別

- 定例会（年4回：3月・6月・9月・12月）
- 臨時会（不定期）

---

## PDF ファイル命名規則

PDF は `/uploaded/attachment/{数値ID}.pdf` の形式で格納されている。ファイル名は連番の数値 ID であり、内容からは推測不可。

令和7年12月定例会（第4回）の例:
- 会期日程表: `/uploaded/attachment/9920.pdf`（131KB）
- 一般質問: `/uploaded/attachment/9923.pdf`（115KB）
- 議決結果: `/uploaded/attachment/9922.pdf`（146KB）

令和8年3月定例会（第1回）の例:
- 会期日程表: `/uploaded/attachment/10147.pdf`（64KB）
- 一般質問: `/uploaded/attachment/10148.pdf`（73KB）
- 議決結果: `/uploaded/attachment/10149.pdf`（215KB）

各会議につき複数の PDF が掲載される。ID は連番だが欠番が生じることがある。

---

## スクレイピング戦略

### Step 1: 議会トップページから年度別一覧 URL の収集

議会トップページ (`/site/gikai/`) から定例会・臨時会の年度別一覧ページへのリンクを収集する。

- 定例会: `list47-{ID}.html`
- 臨時会: `list48-{ID}.html`

### Step 2: 年度別一覧から会議詳細 URL の収集

各年度別一覧ページ（`list47-*.html` / `list48-*.html`）から個別会議のページへのリンクを抽出する。

令和7年定例会の例:
- 第4回（12月）: `/site/gikai/10474.html`
- 第3回（9月）: `/site/gikai/9925.html`
- 第2回（6月）: `/site/gikai/10022.html`
- 第1回（3月）: `/site/gikai/9475.html`

### Step 3: 会議詳細ページから PDF リンクの抽出

各会議詳細ページ（`/site/gikai/{ID}.html`）から `/uploaded/attachment/*.pdf` へのリンクを全件抽出する。

1 会議に通常 2〜3 件の PDF が掲載される（会期日程表・一般質問・議決結果など）。

---

## 注意事項

- PDF の数値 ID は連番ではあるが欠番があり、ID 範囲から全件を推測することはできない
- 会議ページ ID（`/site/gikai/{ID}.html`）も不規則な数値のため、年度別一覧からのリンク抽出が必須
- テキスト検索システムは存在しないため、全 PDF のダウンロードが必要
- 議会だより（`議会だより`）も同サイトに掲載されているが、会議録とは別管理

---

## 推奨アプローチ

1. **3段階クロール**: トップ → 年度別一覧 → 会議詳細 → PDF の順で取得する
2. **定例会・臨時会を別途クロール**: カテゴリ 47（定例会）と 48（臨時会）の両方を対象とする
3. **PDF の複数添付に対応**: 1 会議ページに複数 PDF が存在するため、ページ内の全 PDF リンクを収集する
4. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
