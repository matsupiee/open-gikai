# 網走市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.abashiri.hokkaido.jp/site/gikai/1581.html
- 分類: 市公式サイト上で PDF ファイルとして個別提供（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は HTML ページではなく PDF ファイルで提供。定例会・臨時会・各常任委員会の会議録がある。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.city.abashiri.hokkaido.jp/site/gikai/1581.html` |
| 定例会 本会議 | `https://www.city.abashiri.hokkaido.jp/site/gikai/1568.html` |
| 臨時会 本会議 | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1569.html` |
| 総務経済委員会（H27.5〜） | `https://www.city.abashiri.hokkaido.jp/soshiki/32/6990.html` |
| 文教民生委員会（H27.5〜） | `https://www.city.abashiri.hokkaido.jp/site/gikai/6996.html` |
| 総務文教委員会（H23.3〜H27.4） | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1592.html` |
| 生活福祉委員会（H23.3〜H27.4） | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1588.html` |
| 経済建設委員会（H23.3〜H27.4） | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1582.html` |
| 各会計決算審査特別委員会 | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1583.html` |
| 予算等審査特別委員会 | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1593.html` |
| 地方創生総合戦略検討特別委員会 | `https://www.city.abashiri.hokkaido.jp/site/gikai/10916.html` |
| 新庁舎建設特別委員会 | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1591.html` |
| 新型コロナウイルス感染症対策特別委員会 | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1590.html` |
| 重油漏れ事故対策検討特別委員会 | `https://www.city.abashiri.hokkaido.jp/soshiki/32/1580.html` |
| PDF ファイル | `https://www.city.abashiri.hokkaido.jp/uploaded/attachment/{ID}.pdf` |

---

## 会議種別

### 本会議

- **定例会**: 年4回（3月・6月・9月・12月）。令和元年〜令和7年分が掲載。
- **臨時会**: 不定期開催。令和元年〜令和7年分が掲載。

### 常任委員会（平成27年5月以降）

| 委員会名 | ページ URL |
| --- | --- |
| 総務経済委員会 | `/soshiki/32/6990.html` |
| 文教民生委員会 | `/site/gikai/6996.html` |

### 常任委員会（平成23年3月〜平成27年4月）

| 委員会名 | ページ URL |
| --- | --- |
| 総務文教委員会 | `/soshiki/32/1592.html` |
| 生活福祉委員会 | `/soshiki/32/1588.html` |
| 経済建設委員会 | `/soshiki/32/1582.html` |

### 特別委員会

| 委員会名 | ページ URL |
| --- | --- |
| 各会計決算審査特別委員会 | `/soshiki/32/1583.html` |
| 予算等審査特別委員会 | `/soshiki/32/1593.html` |
| 地方創生総合戦略検討特別委員会 | `/site/gikai/10916.html` |
| 新庁舎建設特別委員会 | `/soshiki/32/1591.html` |
| 新型コロナウイルス感染症対策特別委員会 | `/soshiki/32/1590.html` |
| 重油漏れ事故対策検討特別委員会 | `/soshiki/32/1580.html` |

---

## PDF ファイルの提供形態

- 全会議録は PDF ファイルとして提供される（HTML 本文での会議録提供はない）
- PDF URL パターン: `/uploaded/attachment/{数値ID}.pdf`
  - 例: `/uploaded/attachment/13890.pdf`（令和7年9月定例会）
  - 例: `/uploaded/attachment/13850.pdf`（令和7年10月31日 総務経済委員会）
- ファイルサイズ: 70KB〜3.22MB 程度
- 定例会は1回の定例会につき1つの PDF（全日程分をまとめて収録）
- 委員会は開催日ごとに個別の PDF

---

## スクレイピング戦略

### Step 1: 一覧ページから PDF リンクの収集

各会議種別の一覧ページ（全14ページ）から PDF リンクとメタ情報を収集する。

- 一覧ページはページネーションなし（単一ページに全年度分を表示）
- 各ページの HTML 構造:
  - 定例会: 年度ごとのセクションに「年月日」と PDF リンクをテーブル形式で記載
  - 委員会: `<dt>` に日付、`<dd>` に案件名と PDF リンクを定義リスト形式で記載
- PDF リンクは `<a href="/uploaded/attachment/{ID}.pdf">` 形式

**収集方法:**

1. 14 の一覧ページ URL をハードコードしたリストから順次取得
2. 各ページの HTML を Cheerio でパースし、`/uploaded/attachment/\d+\.pdf` パターンのリンクを抽出
3. リンクの前後テキストから開催日・会議名を抽出
4. PDF URL、開催日、会議種別をセットで記録

### Step 2: PDF ファイルのダウンロード

収集した PDF URL リストからファイルをダウンロードする。

- PDF URL はすべて `https://www.city.abashiri.hokkaido.jp/uploaded/attachment/{ID}.pdf` 形式
- ダウンロード済みファイルは `{ID}.pdf` として保存し、重複ダウンロードを防止

### Step 3: PDF からテキスト抽出

ダウンロードした PDF からテキストを抽出する。

- `pdf-parse` 等のライブラリで PDF からテキストを抽出
- 定例会の PDF は複数日程分を含むため、日付ごとに分割が必要

### Step 4: テキストのパース

#### メタ情報

一覧ページから取得した情報を使用:

- 開催日: 一覧ページのテーブル/定義リストから抽出
- 会議名: 一覧ページの種別から判定（定例会・臨時会・各委員会）

#### 発言の構造

PDF テキストから発言者と発言内容を抽出する。PDF の内部構造は実際のファイルを確認して正規表現を調整する必要がある。

---

## 注意事項

- 会議録は PDF 形式のみで提供されるため、HTML パースではなく PDF テキスト抽出が必要
- 定例会の PDF は1定例会分を1ファイルにまとめているため、複数日程の分割処理が必要
- 常任委員会は平成27年5月を境に改編されている（3委員会 → 2委員会）
- 特別委員会は時限的に設置されるため、対象ページが増減する可能性がある
- PDF の内部構造（フォント、レイアウト）は実際のファイルを確認してパース方法を決定する必要がある

---

## 推奨アプローチ

1. **一覧ページの全量取得を優先**: 14 の一覧ページから PDF リンク + メタ情報の全量リストを作成
2. **PDF ダウンロード → テキスト抽出の2段階**: PDF ファイルをまずダウンロードし、その後テキスト抽出・パースを行う
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: PDF の attachment ID は数値のため、前回取得済みの最大 ID 以降のみを取得する差分更新が可能
5. **PDF パース精度の検証**: 実際の PDF ファイルを数件ダウンロードし、テキスト抽出の精度を事前検証する
