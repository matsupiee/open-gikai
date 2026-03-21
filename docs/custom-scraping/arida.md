# 有田市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.arida.lg.jp/shigikai/honkaigiroku/index.html
- 自治体コード: 302040
- 分類: 年度別 PDF 公開（専用検索システムなし）
- 文字コード: UTF-8
- 特記: 本会議録（定例会）のみ公開。令和3年〜令和7年の5年分が掲載されている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.city.arida.lg.jp/shigikai/honkaigiroku/index.html` |
| 年度別一覧 | `https://www.city.arida.lg.jp/shigikai/honkaigiroku/{年度ID}/index.html` |
| 会議詳細 | `https://www.city.arida.lg.jp/shigikai/honkaigiroku/{年度ID}/{会議ID}.html` |
| PDF ファイル | `https://www.city.arida.lg.jp/shigikai/honkaigiroku/{年度ID}/_res/projects/default_project/_page_/001/{パス}/{ファイル名}.pdf` |

---

## 年度 ID 一覧

| 年度 | 年度ID |
| --- | --- |
| 令和7年 | 1005180 |
| 令和6年 | 1004776 |
| 令和5年 | （要確認） |
| 令和4年 | （要確認） |
| 令和3年 | （要確認） |

※ 年度 ID は 7 桁の数値。新しい年度ほど大きい値となる。

---

## 会議種別

- 本会議（定例会のみ）
  - 2月定例会
  - 6月定例会
  - 9月定例会
  - 12月定例会

※ 委員会会議録は掲載されていない。

---

## PDF ファイル命名規則

各会議ページ（会議ID.html）に複数の PDF が掲載される。ファイル名は会議日の内容を英語表記で命名。

令和7年12月定例会の例:
- `1_r07_12_giansetsumei.pdf` → 第1日 開会・議案説明（12月1日）
- `2_r07_12_ippansitsumon_giansitsugi.pdf` → 第2日 一般質問・議案質疑（12月11日）
- `3_r07_12_giansingi.pdf` → 第3日 追加議案・討論・議案審議・閉会（12月22日）

命名パターン: `{日数}_{年度}_{月}_{内容}.pdf`

PDF の格納パスは `_res/projects/default_project/_page_/001/{年度ID下位}/{会議ID}/` のような構造。

---

## スクレイピング戦略

### Step 1: トップページから年度 ID の収集

トップページ (`index.html`) から各年度の年度別一覧ページへのリンクを取得する。

- 令和3〜7年の5年分が掲載されている
- リンクパターン: `/shigikai/honkaigiroku/{年度ID}/index.html`

### Step 2: 年度別一覧から会議 ID の収集

各年度の `index.html` から定例会ごとの会議詳細ページへのリンクを抽出する。

令和7年の例:
- 12月定例会: `/shigikai/honkaigiroku/1005180/1005452.html`
- 9月定例会: `/shigikai/honkaigiroku/1005180/1005357.html`
- 6月定例会: `/shigikai/honkaigiroku/1005180/1005277.html`
- 2月定例会: `/shigikai/honkaigiroku/1005180/1005183.html`

令和6年の例:
- 12月定例会: `/shigikai/honkaigiroku/1004776/1005101.html`
- 9月定例会: `/shigikai/honkaigiroku/1004776/1005026.html`
- 6月定例会: `/shigikai/honkaigiroku/1004776/1004898.html`
- 2月定例会: `/shigikai/honkaigiroku/1004776/1004782.html`

### Step 3: PDF リンクの抽出

各会議詳細ページから PDF へのリンクを抽出する。1 会議につき複数の PDF（開催日ごとに分割）が掲載される。

---

## 注意事項

- 本会議（定例会）のみの公開で、委員会会議録は掲載されていない
- 各定例会は複数日にわたって開催され、日ごとに別 PDF が掲載される
- テキスト検索システムは存在しないため、全 PDF のダウンロードが必要
- 年度 ID と会議 ID はどちらも数値だが、命名規則は外部からは推測不可のため、一覧ページからのリンク抽出が必須

---

## 推奨アプローチ

1. **トップ → 年度 → 会議の3段階クロール**: 各一覧ページからリンクを再帰的に収集する
2. **年度 ID はトップページから動的取得**: 固定値ではなくページ解析で取得する
3. **PDF の複数添付に対応**: 1 会議ページに複数 PDF が存在するため、ページ内の全 PDF リンクを収集する
4. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
