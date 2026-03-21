# 飛騨市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.hida.gifu.jp/site/gikai/
- 分類: 公式ウェブサイト内の議会ページで PDF を直接公開（専用の会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録は年度ごとに整理された HTML ページから PDF へリンクされる形式。一般質問は個人別 PDF として別ページで提供される。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.city.hida.gifu.jp/site/gikai/` |
| 最新年度（令和7年）会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/72604.html` |
| 過去年度インデックス | `https://www.city.hida.gifu.jp/site/gikai/3517.html` |
| 令和6年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/62150.html` |
| 令和5年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/53785.html` |
| 令和4年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/kaigiroku.html` |
| 令和3年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/r3kaigiroku.html` |
| 令和2年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/r2kaigiroku.html` |
| 令和元年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/r1kaigiroku.html` |
| 平成30年会議録一覧 | `https://www.city.hida.gifu.jp/site/gikai/h30kaigiroku.html` |
| 平成29年会議録一覧 | `https://www.city.hida.gifu.jp/soshiki/25/3518.html` |
| 平成28年会議録一覧 | `https://www.city.hida.gifu.jp/soshiki/25/3523.html` |
| 平成27年会議録一覧 | `https://www.city.hida.gifu.jp/soshiki/25/3524.html` |
| 平成26年会議録一覧 | `https://www.city.hida.gifu.jp/soshiki/25/3525.html` |
| 平成25年会議録一覧 | `https://www.city.hida.gifu.jp/soshiki/25/3526.html` |
| 会議録 PDF | `https://www.city.hida.gifu.jp/uploaded/attachment/{ID}.pdf` |
| 一般質問個人別一覧 | `https://www.city.hida.gifu.jp/site/gikai/{ページID}.html` |

---

## 会議録の提供形式

- すべての会議録は **PDF 形式**で提供される
- PDF の URL パターン: `/uploaded/attachment/{数値ID}.pdf`
- 数値 ID は連番だが、一覧ページから取得する必要がある（ID からコンテンツを推測できない）

---

## 年度・会議種別の構成

### 対象年度

平成25年（2013年）〜令和7年（2025年）。平成25年が最古の記録。

### 会議種別

各定例会・臨時会ごとに以下の会議種別が含まれる:

| 種別 | 備考 |
| --- | --- |
| 本会議 | 複数日にわたって開催 |
| 総務常任委員会 | |
| 産業常任委員会 | |
| 予算特別委員会 | |
| 決算特別委員会 | |
| 連合審査会 | |

### 定例会・臨時会の構成

年間4〜6回程度（定例会4回＋臨時会が随時）。各会議には開催期間が括弧内に表示される。

例: `第4回定例会（11月26日～12月12日）`

---

## スクレイピング戦略

### Step 1: 年度別一覧ページの収集

過去年度インデックスページ（`/site/gikai/3517.html`）から各年度ページの URL を取得する。

年度ページの URL はすべて固定のため、以下のリストをハードコードして利用する:

```
https://www.city.hida.gifu.jp/site/gikai/72604.html  # 令和7年
https://www.city.hida.gifu.jp/site/gikai/62150.html  # 令和6年
https://www.city.hida.gifu.jp/site/gikai/53785.html  # 令和5年
https://www.city.hida.gifu.jp/site/gikai/kaigiroku.html  # 令和4年
https://www.city.hida.gifu.jp/site/gikai/r3kaigiroku.html  # 令和3年
https://www.city.hida.gifu.jp/site/gikai/r2kaigiroku.html  # 令和2年
https://www.city.hida.gifu.jp/site/gikai/r1kaigiroku.html  # 令和元年
https://www.city.hida.gifu.jp/site/gikai/h30kaigiroku.html  # 平成30年
https://www.city.hida.gifu.jp/soshiki/25/3518.html  # 平成29年
https://www.city.hida.gifu.jp/soshiki/25/3523.html  # 平成28年
https://www.city.hida.gifu.jp/soshiki/25/3524.html  # 平成27年
https://www.city.hida.gifu.jp/soshiki/25/3525.html  # 平成26年
https://www.city.hida.gifu.jp/soshiki/25/3526.html  # 平成25年
```

### Step 2: 各年度ページから PDF リンクを収集

各年度ページを取得し、以下のパターンで PDF リンクを抽出する:

- `/uploaded/attachment/{ID}.pdf` へのリンクをすべて収集
- リンクテキストから会議種別・開催日を取得する
- 「個人ごとの一般質問はこちら」リンク（`/site/gikai/{ID}.html` 形式）も収集する

**HTML 構造:**

```html
<!-- 定例会・臨時会見出し（h3 または段落） -->
第4回定例会（11月26日～12月12日）

<!-- 会議録リスト -->
<ul>
  <li><a href="/uploaded/attachment/28773.pdf">本会議（11月26日）[PDFファイル／○KB]</a></li>
  <li><a href="/uploaded/attachment/28769.pdf">本会議（12月4日）[PDFファイル／○KB]</a></li>
  ...
</ul>

<!-- 一般質問個人別ページへのリンク -->
<a href="/site/gikai/68579.html">個人ごとの一般質問はこちら</a>
```

### Step 3: 一般質問個人別ページから PDF リンクを収集

一般質問ページはテーブル形式で議員ごとに 1 行ずつ構成されている:

```html
<table>
  <tr>
    <td>番号</td>
    <td>発言者名（例：佐藤克成）</td>
    <td><a href="/uploaded/attachment/28548.pdf">質問事項・会議録</a></td>
    <td>YouTube動画・発言日</td>
  </tr>
  ...
</table>
```

- 発言者名と PDF リンクをペアで抽出する
- 1 ページにつき複数議員（10〜15 名程度）

### Step 4: PDF のダウンロードとテキスト抽出

- PDF を直接ダウンロードし、テキスト抽出ライブラリ（pdftotext 等）で本文を取得する
- PDF はスキャン画像ではなくテキストレイヤーを持つデジタル PDF であることを確認する
- 1 ファイルが 1 会議日分または 1 議員の一般質問分に対応する

---

## メタ情報の取得方法

PDF の URL を含むリンクテキストからメタ情報を抽出する。

| 情報 | 取得元 |
| --- | --- |
| 開催年度 | 年度ページの URL またはページタイトル |
| 定例会・臨時会の区別 | 見出しテキスト（例：「第4回定例会」「第1回臨時会」） |
| 開催期間 | 見出し括弧内（例：「11月26日～12月12日」） |
| 会議種別 | リンクテキスト（例：「本会議」「総務常任委員会」） |
| 開催日（単日） | リンクテキスト括弧内（例：「（12月4日）」） |
| 発言者名（一般質問） | 一般質問ページのテーブルの発言者列 |

---

## 注意事項

- 専用の全文検索システムは存在しない。PDF 全文はダウンロードしてローカルで解析する必要がある。
- ページネーションは存在しない。各年度ページに当該年の全会議録リンクが掲載されている。
- 年度ページの URL はルールが統一されていない（`kaigiroku.html`、`r3kaigiroku.html`、`62150.html` など混在）ため、URL リストをハードコードする。
- 平成25年以前のデータは公開されていない。
- 一般質問は全体の本会議 PDF にも含まれるが、個人別 PDF でも個別提供されているため、重複に注意する。
- レート制限: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。

---

## 推奨アプローチ

1. **年度リストをハードコード**: URL パターンが不規則なため、既知の年度ページ URL を静的リストとして管理する
2. **PDF リンクを Cheerio で抽出**: `a[href*="/uploaded/attachment/"]` セレクターで全 PDF リンクを取得する
3. **一般質問ページも収集**: `a[href*="/site/gikai/"]` かつリンクテキストが「個人ごとの一般質問はこちら」に一致するリンクを追加収集する
4. **PDF テキスト抽出**: PDF からテキストレイヤーを抽出し、会議録本文をインデックス化する
5. **差分更新**: 過去取得済みの PDF ID を記録し、新規 ID のみ処理する
