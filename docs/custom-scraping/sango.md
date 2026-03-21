# 三郷町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.sango.nara.jp/site/gikai/list7.html
- 分類: 公式サイト内に年度別 PDF 一覧（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 提供形式: PDF（会議ごとに初日・最終日が別ファイル）
- 特記: 令和7年から平成27年（2015年）まで掲載

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧トップ | `https://www.town.sango.nara.jp/site/gikai/list7.html` |
| 年度別一覧インデックス | `https://www.town.sango.nara.jp/site/gikai/list7-28.html` |
| 年度別会議録ページ | `https://www.town.sango.nara.jp/site/gikai/{ページID}.html` |
| PDF ファイル | `https://www.town.sango.nara.jp/uploaded/attachment/{ID}.pdf` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年（2025） | `https://www.town.sango.nara.jp/site/gikai/11721.html` |
| 令和6年（2024） | `https://www.town.sango.nara.jp/site/gikai/11718.html` |
| 令和5年（2023） | `https://www.town.sango.nara.jp/site/gikai/8392.html` |
| 令和4年（2022） | `https://www.town.sango.nara.jp/site/gikai/5638.html` |
| 令和3年（2021） | `https://www.town.sango.nara.jp/site/gikai/2391.html` |
| 令和2年（2020） | `https://www.town.sango.nara.jp/site/gikai/2169.html` |
| 平成31・令和元年（2019） | `https://www.town.sango.nara.jp/site/gikai/1929.html` |
| 平成30年（2018） | `https://www.town.sango.nara.jp/site/gikai/1722.html` |
| 平成29年（2017） | `https://www.town.sango.nara.jp/site/gikai/1524.html` |
| 平成28年（2016） | `https://www.town.sango.nara.jp/site/gikai/1439.html` |
| 平成27年（2015） | `https://www.town.sango.nara.jp/site/gikai/1729.html` |

---

## 会議種別

令和6年の例をもとに確認できた会議種別:

| 種別 | 開催時期の目安 |
| --- | --- |
| 第1回定例会 | 3月 |
| 第1回臨時会 | 5月 |
| 第2回定例会 | 6月 |
| 第3回定例会 | 9月 |
| 第2回臨時会 | 11月 |
| 第4回定例会 | 12月 |

各会議には「初日」「最終日」の2つの PDF が存在する場合がある（単日開催の臨時会は1ファイルのみ）。

---

## PDF 命名規則

PDF ファイルは `/uploaded/attachment/{ID}.pdf` の形式で管理される。ID は数値で連番に近い構成となっており、ファイル名自体には年度・会議種別の情報は含まれない。

例（令和6年）:
- `9737.pdf` - 第1回定例会 初日
- `9738.pdf` - 第1回定例会 最終日
- `9739.pdf` - 第1回臨時会
- `9740.pdf` - 第2回定例会 初日
- `9741.pdf` - 第2回定例会 最終日
- `9742.pdf` - 第3回定例会 初日
- `9743.pdf` - 第3回定例会 最終日
- `9744.pdf` - 第2回臨時会
- `9745.pdf` - 第4回定例会 初日
- `9746.pdf` - 第4回定例会 最終日

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

年度別一覧インデックス `https://www.town.sango.nara.jp/site/gikai/list7-28.html` から各年度ページの URL を取得する。

- `<a>` タグのリンクから `/site/gikai/{ページID}.html` 形式の URL を抽出
- 対象年度: 令和7年〜平成27年（計11年度）

### Step 2: PDF リンクの収集

各年度ページ（`/site/gikai/{ページID}.html`）にアクセスし、PDF リンクを収集する。

- `/uploaded/attachment/{ID}.pdf` 形式のリンクを `<a>` タグから抽出
- 各リンクのテキスト（会議種別・初日/最終日の区別）も合わせて取得する
- 1 年度あたり 10〜12 件程度の PDF が存在する

### Step 3: PDF のダウンロードとテキスト抽出

収集した PDF URL から PDF をダウンロードし、テキストを抽出する。

- PDF からのテキスト抽出には `pdf-parse` 等のライブラリを使用
- ファイルサイズは数百 KB〜2 MB 程度

### Step 4: メタ情報のパース

PDF のテキストまたはページ上のリンクテキストから以下を抽出する:

- 年度（令和・平成）
- 会議種別（定例会・臨時会、第何回）
- 開催日（初日・最終日）

リンクテキストの例:
```
令和6年第1回定例会（3月）初日 [PDFファイル／1.5MB]
令和6年第1回定例会（3月）最終日 [PDFファイル／615KB]
```

---

## 注意事項

- PDF ファイルの ID は連番に近いが、会議録のメタ情報（年度・会議種別・日付）はページ上のリンクテキストから取得する必要がある
- 年度別インデックスページ（`list7-28.html`）の URL は固定であるため、エントリーポイントとして安定して使用できる
- 各年度の会議録ページ ID は連番ではなく不規則なため、インデックスページからの収集が必須
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **インデックスページを起点**: `list7-28.html` から各年度ページ URL を収集し、ハードコードではなく動的に取得する
2. **リンクテキストを活用**: PDF の URL だけでなく隣接するリンクテキストを取得し、会議種別・日付情報を紐付ける
3. **差分更新**: 年度別ページの最終更新日をチェックし、変更がある年度のみ再取得する
4. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
