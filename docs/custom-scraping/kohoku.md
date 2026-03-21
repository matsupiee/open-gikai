# 江北町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kouhoku.saga.jp/list00321.html
- 分類: 自治体独自 CMS（`kiji[番号]/index.html` 形式の詳細ページ + PDF リンク）
- 文字コード: UTF-8
- 特記: jQuery autopager による「もっと見る」動的読み込みあり、多言語翻訳機能あり

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.kouhoku.saga.jp/list00321.html` |
| 年度別一覧（令和8年） | `https://www.town.kouhoku.saga.jp/list00769.html` |
| 年度別一覧（令和7年） | `https://www.town.kouhoku.saga.jp/list00740.html` |
| 会議録詳細ページ | `https://www.town.kouhoku.saga.jp/kiji[番号]/index.html` |
| PDF ファイル | `https://www.town.kouhoku.saga.jp/kiji[番号]/3_[番号]_[番号]_up_[ランダム文字列].pdf` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和8年 | `https://www.town.kouhoku.saga.jp/list00769.html` |
| 令和7年 | `https://www.town.kouhoku.saga.jp/list00740.html` |
| 令和6年 | `https://www.town.kouhoku.saga.jp/list00717.html` |
| 令和5年 | `https://www.town.kouhoku.saga.jp/list00699.html` |
| 令和4年 | `https://www.town.kouhoku.saga.jp/list00682.html` |
| 令和3年 | `https://www.town.kouhoku.saga.jp/list00643.html` |
| 令和2年 | `https://www.town.kouhoku.saga.jp/list00611.html` |
| 平成31年・令和元年 | `https://www.town.kouhoku.saga.jp/list00540.html` |
| 平成30年 | `https://www.town.kouhoku.saga.jp/kiji003696/index.html` |
| 平成29年 | `https://www.town.kouhoku.saga.jp/kiji003695/index.html` |
| 平成28年 | `https://www.town.kouhoku.saga.jp/kiji003694/index.html` |
| 平成27年 | `https://www.town.kouhoku.saga.jp/kiji003693/index.html` |
| 平成26年 | `https://www.town.kouhoku.saga.jp/kiji003692/index.html` |
| 平成25年 | `https://www.town.kouhoku.saga.jp/kiji003691/index.html` |

- 令和2年以降: `list[番号].html` 形式の年度一覧ページ
- 平成25〜30年: `kiji[番号]/index.html` 形式（年度一覧自体が kiji ページ）

---

## 会議録の提供形式

各会議録の詳細ページ（`kiji[番号]/index.html`）に PDF リンクが掲載される形式。

**令和8年1月臨時会の例（kiji0032963）:**

| 文書種別 | URL |
| --- | --- |
| 会期日程 | `https://www.town.kouhoku.saga.jp/kiji0032963/3_2963_6897_up_0rkb5mqt.pdf` |
| 会議録本文 | `https://www.town.kouhoku.saga.jp/kiji0032963/3_2963_6898_up_opyw3kgh.pdf` |

**PDF URL 形式:**
```
https://www.town.kouhoku.saga.jp/kiji[番号]/3_[kiji番号]_[ファイルID]_up_[ランダム文字列].pdf
```

- kiji 番号と PDF の番号が対応しており、URL 予測は困難
- 必ずページから直接リンクを抽出する

---

## 会議種別

**令和7年の構成（8件）:**

| 開催月 | 会議種別 | kiji番号 |
| --- | --- | --- |
| 1月 | 臨時会 | kiji0032800 |
| 3月 | 定例会 | kiji0032806 |
| 4月 | 臨時会 | kiji0032851 |
| 6月 | 定例会 | kiji0032865 |
| 7月 | 臨時会 | kiji0032887 |
| 9月 | 定例会 | kiji0032906 |
| 10月 | 臨時会 | kiji0032937 |
| 12月 | 定例会 | kiji0032927 |

定例会4回・臨時会4回で年8件程度。他の年度は年4〜6件程度と想定。

---

## ページネーション

「もっと見る」ボタンによる jQuery autopager での動的読み込み。1年度あたりの件数が多い場合は複数ページに分割される可能性がある。

---

## スクレイピング戦略

### Step 1: 年度ページ URL の収集

トップページ（`/list00321.html`）から全年度ページへのリンクを抽出する。

- 令和2年以降: `list[番号].html` 形式
- 平成25〜30年: `kiji[番号]/index.html` 形式
- 最古: 平成25年（2013年）

### Step 2: 年度別ページから会議録詳細ページ URL を収集

各年度ページから `kiji[番号]/index.html` 形式のリンクを抽出する。

- 1年度あたり4〜8件程度
- 「もっと見る」が存在する場合は autopager のページング処理を行う
  - autopager パラメータ（`?page=2` 等）を確認して全件取得する

### Step 3: 会議録詳細ページから PDF リンクを収集

`kiji[番号]/index.html` ページ内の `<a href="...pdf">` を抽出する。

- 1会議あたり通常2〜4件の PDF（会期日程 + 会議録本文 + 委員会記録等）
- ファイル名の `_up_[ランダム文字列]` 部分は推測不可能なため、必ずページから取得

### Step 4: PDF のダウンロードと解析

- 詳細ページのタイトル（例: `令和8年1月 臨時会　会議録`）から会議種別・開催年月を取得
- ページの更新日（`最終更新日`）をクロール済み判定に活用できる

---

## 注意事項

- 平成25年（2013年）から掲載あり
- 平成25〜30年の年度ページは `kiji003691〜kiji003696` の連番で管理されている
- PDF の URL は完全にランダムなためページから必ず取得する
