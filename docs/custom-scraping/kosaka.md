# 小坂町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/index.html
- 分類: 自治体 CMS による年度別 PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で公開。平成29年（2017年）〜令和7年（2025年）の9年度分が掲載

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/index.html` |
| 年度別一覧（初期） | `https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/{パスID}/index.html` |
| 年度別一覧（後期） | `https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/{数値ID}.html` |
| 会議詳細（初期） | `https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/{パスID}/{数値ID}.html` |
| 会議詳細（後期） | `https://www.town.kosaka.akita.jp/machinososhiki/gikaijimukyoku/kaigiroku/{年度フォルダ}/{数値ID}.html` |
| PDF ファイル | `https://www.town.kosaka.akita.jp/material/files/group/5/{ファイル名}.pdf` |

### 年度別一覧ページの URL

| 年度 | URL |
| --- | --- |
| 平成29年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/1/index.html` |
| 平成30年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/2/index.html` |
| 平成31年・令和元年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/1223.html` |
| 令和2年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/1655.html` |
| 令和3年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/1890.html` |
| 令和4年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/2215.html` |
| 令和5年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/2372.html` |
| 令和6年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/2607.html` |
| 令和7年 | `/kurashi_gyosei/kosakamachigikai/kaigiroku/2876.html` |

---

## ページ階層

```
会議録トップ（年度一覧）
  └─ 年度別一覧ページ（例: 令和7年会議録）
       └─ 会議詳細ページ（例: 令和7年第2回定例会）
            └─ PDF ファイル（初日 / 一般質問 / 最終日 など）
```

---

## 会議種別

各年度に定例会と臨時会が混在する。

- **定例会**: 通常3日間の日程（初日・一般質問・最終日）で、PDF が3つ
- **臨時会**: 通常1日のみで、PDF が1つ

---

## PDF ファイルの命名パターン

PDF のファイル名は年度・時期によって規則が異なる。

### 初期（平成29年〜30年頃）

連番形式: `{連番}download.pdf`

```
7888download.pdf  （平成29年第8回定例会・初日）
7889download.pdf  （平成29年第8回定例会・一般質問）
7890download.pdf  （平成29年第8回定例会・最終日）
```

### 後期（令和6年〜）

意味のあるファイル名: `{年号}-{回}{内容}.pdf` または `{年号}{回}{内容}.pdf`

```
R6-1syoniti.pdf          （令和6年第1回定例会・初日）
R6-1ippannsitumonn.pdf   （令和6年第1回定例会・一般質問）
R6-1saisyuubi.pdf        （令和6年第1回定例会・最終日）
R6-2rinnjikai1.pdf       （令和6年第2回臨時会）
R0702teireikaishonichi.pdf       （令和7年第2回定例会・初日）
R0702teireikaiippannshitsumonn.pdf （令和7年第2回定例会・一般質問）
R0702teireikaishaishuubi.pdf     （令和7年第2回定例会・最終日）
0701kaigiroku.pdf        （令和7年第1回臨時会）
```

### PDF の共通格納パス

すべての PDF は同一ディレクトリに格納されている:

```
https://www.town.kosaka.akita.jp/material/files/group/5/{ファイル名}.pdf
```

---

## スクレイピング戦略

### Step 1: 年度別一覧ページの URL 収集

会議録トップページ `kaigiroku/index.html` から各年度ページへのリンクを抽出する。

- 年度一覧はリスト形式で表示
- 各年度のリンク URL はパターンが不規則（`/1/index.html`, `/1223.html` など）なため、HTML から直接抽出が必要
- ページネーションなし（全9年度が1ページに表示）

### Step 2: 会議詳細ページの URL 収集

各年度一覧ページから個別の会議詳細ページへのリンクを抽出する。

- 一覧はリスト形式（`<ol>` または `<ul>`）で表示
- 各項目にはリンクテキストとして「令和X年第Y回小坂町議会（定例会/臨時会）」が含まれる
- リンク先のドメインパスが年度によって異なる場合がある（`/kurashi_gyosei/...` と `/machinososhiki/...`）

### Step 3: PDF リンクの収集

各会議詳細ページから PDF ファイルへのリンクを抽出する。

- 定例会: 通常3つの PDF（初日・一般質問・最終日）
- 臨時会: 通常1つの PDF
- リンクは `//www.town.kosaka.akita.jp/material/files/group/5/...` 形式（プロトコル相対 URL）
- ファイルサイズも記載あり

### Step 4: PDF のダウンロードとテキスト抽出

PDF をダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）でテキストを抽出
- 会議のメタ情報（開催日、会議名、種別）は会議詳細ページのタイトルおよびリンクテキストから取得

---

## メタ情報の抽出

### 会議詳細ページから取得可能な情報

- 会議名: ページタイトルから `令和X年第Y回小坂町議会（定例会/臨時会）` を抽出
- 開催日: PDF リンクのテキストに含まれる（例: 「初日（12月12日）」）
- 会議種別: タイトルの括弧内（定例会 / 臨時会）

### メタ情報抽出の正規表現（案）

```typescript
// 会議名・種別の抽出（ページタイトルから）
const meetingPattern = /(令和|平成)\d+年第\d+回小坂町議会（(定例会|臨時会)）/;

// 開催日の抽出（PDF リンクテキストから）
const datePattern = /(\d+)月(\d+)日/;
```

---

## 注意事項

- PDF ファイルのファイル名規則が年度によって異なるため、ファイル名からのメタ情報抽出は不安定。HTML ページからのメタ情報取得を優先する
- URL パスの構造が年度によって異なる（`/kurashi_gyosei/...` と `/machinososhiki/...`）ため、相対 URL のベース解決に注意が必要
- PDF リンクがプロトコル相対 URL（`//www.town.kosaka.akita.jp/...`）で記載されているため、`https:` を付加する必要がある
- 全 PDF が `/material/files/group/5/` 配下に格納されており、他の議会資料と混在している可能性がある

---

## 推奨アプローチ

1. **3段階クロール**: トップページ → 年度一覧 → 会議詳細 → PDF の順にリンクを辿る
2. **PDF テキスト抽出**: PDF 形式のため、HTML パースではなく PDF パーサーを使用する
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **メタ情報は HTML から取得**: PDF のファイル名規則が不統一なため、会議名・開催日・種別は HTML ページのテキストから取得する
5. **差分更新**: 年度一覧ページの会議数を前回と比較し、新規追加分のみを取得する
