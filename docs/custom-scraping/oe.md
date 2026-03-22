# 大江町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/
- 分類: PDF 公開（自治体公式サイト）
- 文字コード: UTF-8

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/` |
| 年度別ページ | `https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/{数字ID}` |
| PDF ファイル | `https://www.town.oe.yamagata.jp/files/original/{ハッシュ値}.pdf` |

---

## ページ階層

```
ホーム > 町政・町づくり > 町政 > 議会 > 会議録
├── 令和７年 会議録（/chougikai_kaigiroku/1655）
├── 令和６年 会議録
├── 令和5年 会議録
│   └── ...
└── 過去年度
```

---

## PDF ファイルの命名規則

ファイル名はタイムスタンプ + ランダムハッシュ形式:

`{YYYYMMDDHHmmss}{ハッシュ}.pdf`

例: `202507110904148260ec7103d.pdf`

- ファイル名に会議情報は含まれない
- リンクテキストから会議種別・日付を取得する必要がある

---

## リンクテキストの形式

各 PDF リンクのテキストは以下の形式:

```
第{回数}回{会議種別}（令和{年}年{月}月{日}日〜{日}日）
```

例: `第1回定例会（令和7年3月4日〜12日）`

ファイルサイズも `PDF：1.4MB` の形式で表示される。

---

## スクレイピング戦略

### Step 1: 年度別ページ URL を収集

トップページから年度別リンクを収集する。リンクは `/chougikai_kaigiroku/{数字ID}` 形式。

### Step 2: 年度別ページから PDF URL を収集

各年度ページをパースし、`/files/original/` 配下の PDF リンクとリンクテキスト（会議名・日付情報）を取得する。

### Step 3: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、テキストを抽出する。

---

## 注意事項

- PDF ファイル名にはハッシュ値が使われており、ファイル名から会議情報を推測できない
- 会議名・日付はリンクテキストから取得する必要がある
- レート制限: リクエスト間に適切な待機時間（1〜2 秒）を設ける
