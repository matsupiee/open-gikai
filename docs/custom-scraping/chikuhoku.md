# 筑北村議会 カスタムスクレイピング方針

## 概要

- 公式サイト: https://www.vill.chikuhoku.lg.jp/gikai/
- 会議録検索システム URL: https://smart.discussvision.net/smart/tenant/chikusei/WebView/rd/council_1.html
- 分類: DiscussVision Smart（議会映像配信・会議録検索システム）
- 文字コード: UTF-8
- テナント ID: `516`（テナント名: `chikusei`）

### テナント名の不一致について（要注意）

DiscussVision Smart のテナント名が `chikusei`（筑西市）となっており、**筑北村のデータではなく筑西市（茨城県）のデータである可能性が高い**。

以下の根拠から、このシステムは筑西市議会のものと判断される:

1. **動画ファイルパス**: API レスポンスの `movie_name1` が `chikusei/W_r06/...` のように筑西市を示すプレフィックスを使用
2. **議員名**: API から取得できる議員名（三澤隆一、日隅久江、吉富泰宣、藤澤和成 等）は筑西市議会の議員
3. **会議構成**: 定例会・臨時会の構成（3月・6月・9月・12月定例会、1月・8月・11月臨時会）が筑西市議会のパターンと一致
4. **公式サイトにリンクなし**: 筑北村議会の公式サイト（https://www.vill.chikuhoku.lg.jp/gikai/）にはこの DiscussVision システムへのリンクが存在しない

**結論: このシステムは筑北村（長野県）のものではなく、筑西市（茨城県）のものである。筑北村の会議録検索システムは現時点で未確認。**

---

## 筑北村公式サイトの調査結果

### 議会ページ構成

| ページ | URL | 内容 |
| --- | --- | --- |
| 議会トップ | `https://www.vill.chikuhoku.lg.jp/gikai/` | 議会について、定例会・臨時会、議会報へのリンク |
| 議会について | `https://www.vill.chikuhoku.lg.jp/gikai/gikai/` | 議会の基本情報 |
| 定例会・臨時会 | `https://www.vill.chikuhoku.lg.jp/gikai/teirei/` | 「登録情報はございません。」と表示（データなし） |
| 議会報 | `https://www.vill.chikuhoku.lg.jp/gikai/kaiho/` | 議会だよりの掲載 |

### 確認事項

- 議会公式ページに**会議録検索システムへのリンクは存在しない**
- 「定例会・臨時会」ページは「登録情報はございません。」と表示されており、コンテンツが未登録
- 会議録・議事録の公開ページも確認できない
- DiscussVision や他の外部システムへのリンクも確認できない

---

## DiscussVision Smart API（テナント chikusei / tenant_id=516）の調査結果

※ 以下は参考情報として、`chikusei` テナントの API 構造を記録する。筑西市のデータである可能性が高い。

### バックエンド API（JSON）

ベース URL: `https://smart.discussvision.net/dvsapi/`

| API | エンドポイント | 主要パラメータ |
| --- | --- | --- |
| 年度一覧 | `yearlist` | `tenant_id=516` |
| 会議・日程・発言一覧 | `councilrd/all` | `year`, `tenant_id=516` |
| キーワード検索 | `councilrd/search` | `tenant_id=516`, `keywords`, `logical_op` |
| 発言者一覧 | `speaker/list` | `tenant_id=516` |
| 会議録テキスト | `minute/text` | `tenant_id=516`, `council_id`, `schedule_id`, `playlist_id` |

### 年度範囲

平成28年（2016）〜 令和8年（2026）の11年度分。

### 会議録テキスト

`minute/text` API は全会議で `error_code: 2004`（データなし）を返す。会議録テキストは未登録。発言の要約テキスト（`content` フィールド = 議題一覧）のみ取得可能。

### 発言者一覧

`speaker/list` API は空配列を返す。発言者の詳細情報は未登録。各会議の `playlist` 内の `speaker` フィールドから議員名を取得可能。

---

## 推奨アプローチ

1. **このシステムは筑北村のものではない可能性が高い**: テナント名 `chikusei` は筑西市（茨城県）を示しており、筑北村（長野県）の会議録システムとしては使用すべきではない。
2. **筑北村の会議録は現時点で未公開**: 公式サイトに会議録検索システムへのリンクがなく、定例会・臨時会ページもデータが未登録の状態。
3. **定期的な再確認を推奨**: 筑北村が将来的に会議録検索システムを導入する可能性があるため、公式サイトを定期的に確認する。
4. **municipalities.csv の URL は要修正**: 筑西市のシステム URL が誤って筑北村に紐づけられている場合は修正が必要。
