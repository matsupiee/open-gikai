# 天川村議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/nara/WebView/rd/council_1.html
- 分類: DiscussVision Smart（`smart.discussvision.net`）による映像配信システム
- テナント ID: 258
- テナント名: `nara`（奈良市議会名義で運用）
- 特記: 指定 URL は**奈良市議会の映像配信テナント**であり、天川村専用のテナントは存在しない。テキスト形式の会議録は全期間にわたって提供されていない（`minute_text` が空）。

---

## ステータス

**テキスト会議録なし（映像配信のみ）**

tenant_id=258 の全年・全会議を通じて `minute_text` フィールドが空配列であることを API で確認済み（`minute/text` API は `error_code: 2004`（データなし）を返す）。テキストスクレイピングの対象外とする。

---

## 調査結果

### テナント構成

| 項目 | 詳細 |
| --- | --- |
| テナント URL | `https://smart.discussvision.net/smart/tenant/nara/` |
| テナント ID | 258（`tenant.js` で設定） |
| テナントタイトル | 奈良市議会 議会中継 |
| データ範囲 | 令和5年（2023年）〜令和8年（2026年） |
| 文字コード | UTF-8 |

### 天川村との関係

ユーザー指定 URL の `tenant/nara` は奈良市議会専用テナントであり、天川村の議会データは含まれていない。DiscussVision Smart 上に天川村専用テナント（`tenant/tenkawa` 等）も存在しない（404 を確認済み）。

「奈良県内の複数市町村が共同利用するシステム」との情報があったが、実際には奈良市議会単独のテナントであった。

### フロントエンド構成

| ページ | URL |
| --- | --- |
| 会議名一覧（映像） | `https://smart.discussvision.net/smart/tenant/nara/WebView/rd/council_1.html` |
| 会議名一覧（会議録） | `https://smart.discussvision.net/smart/tenant/nara/WebView/rd/council_2.html` |
| 振り分けページ | `https://smart.discussvision.net/smart/tenant/nara/WebView/rd/council.html` |
| 条件検索 | `https://smart.discussvision.net/smart/tenant/nara/WebView/rd/search.html` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/nara/WebView/rd/result.html` |
| 発言詳細 | `https://smart.discussvision.net/smart/tenant/nara/WebView/rd/speech.html` |

- `council.html` は `COUNCIL` 変数の値に基づき `council_1.html`（映像付き）または `council_2.html`（会議録）にリダイレクトする
- jQuery + JSONP ベースの SPA 構成。会議一覧はページ読み込み後に API で動的に描画される

### API エンドポイント

ベース URL: `https://smart.discussvision.net/dvsapi/`

| エンドポイント | 用途 | パラメータ |
| --- | --- | --- |
| `yearlist` | 年一覧の取得 | `tenant_id` |
| `councilrd/all` | 会議一覧の取得 | `tenant_id`, `year` |
| `councilrd/live` | ライブ中継情報の取得 | `tenant_id`, `council_id` |
| `councilrd/search` | キーワード検索 | `tenant_id`, `keywords`, `logical_op`, `from`, `to` 等 |
| `minute/text` | テキスト会議録の取得 | `tenant_id`, `council_id`, `schedule_id`, `playlist_id` |
| `group/memberlist` | 会派・議員一覧 | `tenant_id`, `type` |
| `speaker/list` | 発言者一覧 | `tenant_id`, `search_index`, `speaker_id` |
| `tenant/all` | テナント情報 | `tenant_id` |

すべてのエンドポイントは JSONP 形式（`callback` パラメータ指定）で応答する。

### テキスト会議録の確認結果

```
GET /dvsapi/minute/text?tenant_id=258&council_id=188&schedule_id=1&playlist_id=1&callback=cb
→ cb([{"error_code ":2004}])
```

全レコードで `error_code: 2004`（データなし）が返る。テキスト会議録は未登録。

### 奈良市議会の公式会議録

奈良市議会の公式テキスト会議録は、DiscussVision とは別のシステムで提供されている:

- 会議録検索システム: https://ssp.kaigiroku.net/tenant/narashi/pg/index.html

このシステムは天川村の会議録とは無関係。

---

## 取得可能なデータ

| データ種別 | 取得可否 | 備考 |
| --- | --- | --- |
| 会議名・日付 | - | 奈良市議会のデータのみ。天川村データなし |
| 発言者氏名 | - | 同上 |
| 質問概要 | - | `content` フィールド（数行程度の要約のみ） |
| 全文テキスト会議録 | x | 全期間で未提供 |
| 動画 URL | - | 奈良市議会の映像のみ |

---

## 推奨アプローチ

指定 URL のシステムは天川村の議会データを含まないため、**現時点ではスクレイピング対象外**とする。

天川村議会の会議録を取得するには、以下の追加調査が必要:

1. **天川村公式サイトの調査**: 天川村独自の会議録公開ページが存在するか確認する
2. **他の会議録検索システムの確認**: `ssp.kaigiroku.net` や `dbsearch` 等の既存アダプターで対応できるシステムに天川村が登録されていないか調査する
3. **DiscussVision の別テナント調査**: 天川村を含む広域テナントが別の tenant_id で存在しないか確認する
