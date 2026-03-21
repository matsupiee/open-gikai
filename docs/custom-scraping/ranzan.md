# 嵐山町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.ranzan.saitama.jp/category/2-19-9-0-0-0-0-0-0-0.html
- 分類: 自治体 CMS による PDF 公開（専用検索システムなし）
- 文字コード: UTF-8
- 特記: 年度別・会議種別ごとに個別ページを設け、PDF を 1 ファイルずつ提供。平成20年（2008年）から現在まで。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧トップ | `https://www.town.ranzan.saitama.jp/category/2-19-9-0-0-0-0-0-0-0.html` |
| 年度別カテゴリ | `https://www.town.ranzan.saitama.jp/category/2-19-9-{年度ID}-0-0-0-0-0-0.html` |
| 個別会議録ページ | `https://www.town.ranzan.saitama.jp/{記事ID}.html` |
| PDF ファイル | `https://www.town.ranzan.saitama.jp/cmsfiles/contents/{グループID}/{記事ID}/{ファイル名}.pdf` |

---

## 年度別カテゴリページ

年度別カテゴリページの ID は連番ではなく以下のとおり：

| 年度 | カテゴリ URL |
| --- | --- |
| 令和8年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-19-0-0-0-0-0-0.html` |
| 令和7年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-18-0-0-0-0-0-0.html` |
| 令和6年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-17-0-0-0-0-0-0.html` |
| 令和5年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-1-0-0-0-0-0-0.html` |
| 令和4年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-2-0-0-0-0-0-0.html` |
| 令和3年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-3-0-0-0-0-0-0.html` |
| 令和2年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-4-0-0-0-0-0-0.html` |
| 平成31年・令和元年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-5-0-0-0-0-0-0.html` |
| 平成30年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-6-0-0-0-0-0-0.html` |
| 平成29年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-7-0-0-0-0-0-0.html` |
| 平成28年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-9-0-0-0-0-0-0.html` |
| 平成27年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-10-0-0-0-0-0-0.html` |
| 平成26年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-8-0-0-0-0-0-0.html` |
| 平成25年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-11-0-0-0-0-0-0.html` |
| 平成24年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-12-0-0-0-0-0-0.html` |
| 平成23年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-13-0-0-0-0-0-0.html` |
| 平成22年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-14-0-0-0-0-0-0.html` |
| 平成21年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-15-0-0-0-0-0-0.html` |
| 平成20年 | `https://www.town.ranzan.saitama.jp/category/2-19-9-16-0-0-0-0-0-0.html` |

---

## 会議種別

各年度で以下の会議種別が存在する（年度によって開催数は異なる）：

| 会議種別 | 備考 |
| --- | --- |
| 第1回定例会 | 通常3月開催 |
| 第2回定例会 | 通常6月開催 |
| 第3回定例会 | 通常9月開催 |
| 第4回定例会 | 通常12月開催 |
| 臨時会 | 第1回・第2回等、年度によって異なる |
| 予算特別委員会 | 通常3月開催 |
| 決算審査特別委員会 | 通常9月開催 |

---

## PDF ファイル命名規則

```
R[元号年2桁][月2桁][種別コード].pdf
```

| フィールド | 内容 |
| --- | --- |
| `R` | 令和（Reiwa）のプレフィックス |
| `[元号年2桁]` | 令和年（例: `07` → 令和7年） |
| `[月2桁]` | 開催月（例: `09` → 9月） |
| `[種別コード]` | `T` = 定例会、`Y` = 予算、`K` = 決算、その他 |

例：
- `R0709K.pdf` → 令和7年9月 決算審査特別委員会
- `R0709T.pdf` → 令和7年9月 第3回定例会
- `R0703Y.pdf` → 令和7年3月 予算特別委員会

---

## HTML 構造

### 一覧ページ（カテゴリページ）

```html
<h2><a href="../category/2-19-9-18-0-0-0-0-0-0.html">令和7年</a></h2>
<ul>
  <li><a href="https://www.town.ranzan.saitama.jp/0000007843.html">決算審査特別委員会会議録</a></li>
  <li><a href="https://www.town.ranzan.saitama.jp/0000007842.html">第3回定例会</a></li>
  ...
</ul>
```

- 年度ごとに `<h2>` で区切られ、配下の `<ul><li>` に個別会議録ページへのリンクが並ぶ
- ページネーションなし（単一ページに全年度を表示）

### 個別会議録ページ

```html
<a href="./cmsfiles/contents/0000007/7843/R0709K.pdf">
  <img src="images/pdf.gif"> 令和7年決算審査特別委員会会議録 (PDF形式、2.66MB)
</a>
```

- 1 ページにつき PDF は原則 1 ファイル
- PDF リンクは `<a>` タグで記述され、`img` タグの PDF アイコンが付随

---

## スクレイピング戦略

### Step 1: 年度別カテゴリページから個別会議録ページ URL を収集

一覧トップページ `category/2-19-9-0-0-0-0-0-0-0.html` を取得し、各年度カテゴリページへのリンクを抽出する。または、上記テーブルの固定 URL リストを使用する。

各年度カテゴリページ（`category/2-19-9-{年度ID}-0-0-0-0-0-0.html`）を取得し、`<ul><li><a>` から個別会議録ページの URL（`https://www.town.ranzan.saitama.jp/{記事ID}.html`）を抽出する。

### Step 2: 個別会議録ページから PDF URL を収集

各個別会議録ページを取得し、`.cmsfiles/contents/` を含む `<a>` タグの `href` 属性から PDF URL を抽出する。

```
https://www.town.ranzan.saitama.jp/cmsfiles/contents/{グループID}/{記事ID}/{ファイル名}.pdf
```

### Step 3: PDF のダウンロードとメタ情報の記録

- PDF をダウンロードし、ページタイトルから会議名・年度を記録する
- ファイル名の命名規則（`R[年][月][種別].pdf`）からもメタ情報を補完できる

---

## 注意事項

- 専用の全文検索システムは存在しない。PDF のみ提供のため、テキスト抽出には PDF パーサーが必要
- 年度別カテゴリページの ID は連番ではなく不規則なため、トップページから動的に取得するか、上記テーブルを参照する
- 一覧トップページに全年度リンクが集約されているため、ページネーションへの対応は不要
- 1 会議録につき PDF は 1 ファイルが基本。複数ファイルへの分割は確認されていない
- レート制限のため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **一覧ページからカテゴリ URL を収集**: トップページから年度別カテゴリページの URL を動的に取得する（新年度追加に自動対応）
2. **カテゴリページから記事 URL を収集**: 各年度カテゴリページから個別会議録ページの URL を抽出する
3. **PDF URL を抽出**: 個別ページの `cmsfiles` リンクから PDF の直接 URL を取得する
4. **PDF をダウンロード・テキスト抽出**: ページタイトルとファイル名の命名規則を組み合わせてメタ情報を付与する
5. **差分更新**: 記事 ID の大きいものが新しいため、既取得の最大記事 ID より大きいもののみを対象に差分取得が可能
