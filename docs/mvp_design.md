# 議会答弁ブレ防止支援ツール（MVP）設計書

最小で「**過去答弁を検索する**」ところだけ作る。
（承認フロー・高度な矛盾検知は _未来の自分_ に任せる）

---

## 1. 目的（MVP スコープ）

### 目的

- 公開情報のスクレイピングで議事録を DB に取り込み、過去答弁を**検索**できる
- 都道府県・自治体名・日付範囲で絞り込みできる

### 非目的（MVP ではやらない）

- 質問を入力すると、**根拠（URL/会議/日付）付き**の回答ドラフトを作れる
- 根拠が無い主張を避け、担当者の「盛り」を防ぐ（= **根拠強制**）
- 承認ワークフロー（レビュー/承認）
- 手動アップロード UI（スクレイピングで代替）
- 自動政策分類（タグは手動付与）
- 立場の変遷可視化、矛盾スコア算出などの高度分析
- スクレイピングの自動スケジューリング（MVP は `bun run scrape` 手動実行）

---

## 2. ユーザーストーリー

1. **議事録を取り込む**

   - スクレイパーが国会議事録 API（NDL）または地方議会サイトから公開議事録を取得し、DB に保存する
   - `bun run scrape --source ndl --from 2024-01` のように手動で実行する
   - 都道府県・自治体・開催日・外部 ID で重複を防ぐ

2. **答弁を探す**

   - 担当がキーワード/類似検索で過去答弁を探し、根拠 URL を確認する
   - 都道府県・自治体名・日付範囲・議会レベル（国会/都道府県/市区町村）で絞り込める

---

## 3. 画面（2 つだけ）

### 3.1 議事録ブラウザ

- 取り込み済み議事録の一覧・検索画面（アップロード UI は不要）
- フィルタ：都道府県セレクト、自治体名テキスト、会議種別、日付範囲、議会レベル
- 一覧表示：タイトル、都道府県/自治体、開催日、ステータスバッジ（pending/done/failed）
- 行クリックで詳細（発言一覧）へ

### 3.2 答弁検索

- キーワード検索
- 類似検索（ベクトル検索）切り替えトグル
- 絞り込み：日付範囲、会議種別、発言者、政策タグ、**都道府県、自治体名、議会レベル**
- 結果カード：発言内容、会議名、日付、発言者、source_url、都道府県/自治体

---

## 4. データフロー

1. スクレイパーが公開 API または HTML から議事録を取得し `meetings` に保存
2. 文章を「発言単位（できれば質問/答弁）」で分割して `statements` に保存
3. 各 `statement` に embedding を付与して pgvector に格納

---

## 5. DB 設計（PostgreSQL + pgvector）

> 目標：**検索で困らない**、**根拠リンクが必ず追える**、**再現性がある**。

### 5.1 拡張

- `pgvector` を利用（embedding 保存/類似検索）

---

### 5.2 テーブル定義（具体）

#### 5.2.1 `users`（MVP は簡易でも可）

| column     | type        | constraints                         |
| ---------- | ----------- | ----------------------------------- |
| id         | uuid        | PK                                  |
| email      | text        | UNIQUE, NOT NULL                    |
| name       | text        | NOT NULL                            |
| role       | text        | NOT NULL (e.g. admin/editor/viewer) |
| created_at | timestamptz | NOT NULL default now()              |

**Index**

- `users(email)` unique

---

#### 5.2.2 `meetings`（議事録の"箱"）

| column         | type        | constraints                                                  |
| -------------- | ----------- | ------------------------------------------------------------ |
| id             | uuid        | PK                                                           |
| title          | text        | NOT NULL（例：令和 5 年 3 月定例会 本会議）                  |
| meeting_type   | text        | NOT NULL（例：plenary/committee/council）                    |
| held_on        | date        | NOT NULL                                                     |
| source_url     | text        | NULL（元ページ URL）                                         |
| assembly_level | text        | NOT NULL（`national` / `prefectural` / `municipal`）         |
| prefecture     | text        | NULL（都道府県名。国会は NULL）                              |
| municipality   | text        | NULL（自治体名。国会・都道府県は NULL）                      |
| external_id    | text        | NULL（NDL speechID 等の外部識別子、重複防止用）              |
| raw_text       | text        | NOT NULL（取得済み全文）                                     |
| status         | text        | NOT NULL default 'pending'（pending/processing/done/failed） |
| scraped_at     | timestamptz | NULL（スクレイピング日時）                                   |
| created_at     | timestamptz | NOT NULL default now()                                       |

**Constraints**

- `UNIQUE(assembly_level, external_id)` — NDL 等の重複防止

**Index**

- `meetings(held_on desc)`
- `meetings(meeting_type, held_on desc)`
- `meetings(assembly_level, held_on desc)`
- `meetings(prefecture, held_on desc)`
- `meetings(municipality, held_on desc)`

---

#### 5.2.3 `statements`（発言断片：最重要）

> 質問/答弁/意見を **同じ器** に入れて扱う。MVP はこれで十分。

| column       | type         | constraints                                |
| ------------ | ------------ | ------------------------------------------ |
| id           | uuid         | PK                                         |
| meeting_id   | uuid         | FK -> meetings(id), NOT NULL               |
| kind         | text         | NOT NULL（question/answer/remark/unknown） |
| speaker_name | text         | NULL（MVP は文字列で OK）                  |
| speaker_role | text         | NULL（市長/部長/議員など）                 |
| content      | text         | NOT NULL                                   |
| content_hash | text         | NOT NULL（重複防止用）                     |
| start_offset | integer      | NULL（raw_text 内の開始位置、取れるなら）  |
| end_offset   | integer      | NULL                                       |
| page_hint    | text         | NULL（PDF ページ等、分かる範囲で）         |
| embedding    | vector(1536) | NULL（モデル次第で次元変更）               |
| created_at   | timestamptz  | NOT NULL default now()                     |

**Constraints**

- `UNIQUE(meeting_id, content_hash)`（同一議事録内の重複防止）

**Index（検索を速くするやつ）**

- `statements(meeting_id)`
- `statements(kind)`
- `statements(speaker_name)`
- 全文検索（MVP 用）：
  - `ALTER TABLE statements ADD COLUMN content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content,''))) STORED;`
  - `CREATE INDEX statements_content_tsv_idx ON statements USING gin (content_tsv);`
- ベクトル検索（例：HNSW）：
  - `CREATE INDEX statements_embedding_idx ON statements USING hnsw (embedding vector_cosine_ops);`

---

#### 5.2.4 `policy_tags`

| column     | type        | constraints            |
| ---------- | ----------- | ---------------------- |
| id         | uuid        | PK                     |
| name       | text        | UNIQUE, NOT NULL       |
| created_at | timestamptz | NOT NULL default now() |

---

#### 5.2.5 `statement_policy_tags`（多対多）

| column       | type | constraints                     |
| ------------ | ---- | ------------------------------- |
| statement_id | uuid | FK -> statements(id), NOT NULL  |
| tag_id       | uuid | FK -> policy_tags(id), NOT NULL |

**PK**

- `(statement_id, tag_id)`

**Index**

- `statement_policy_tags(tag_id, statement_id)`

---

## 6. API（oRPC）

### 6.1 議事録

- `meetings.list`: フィルタリング + ページネーション
  - input: `{ heldOnFrom?, heldOnTo?, meetingType?, assemblyLevel?, prefecture?, municipality?, cursor? }`
- `meetings.get`: ID 指定で取得（statements の件数も含む）
- `meetings.process`: 手動再処理トリガー（embedding 付与し直し）

> ※ 議事録の登録はスクレイパーが直接 DB に書き込むため、`meetings.create` は不要。

### 6.2 発言検索

- `statements.search`: 全文検索 (content_tsv GIN) + フィルタ
  - input: `{ q?, kind?, speakerName?, tagIds?, heldOnFrom?, heldOnTo?, prefecture?, municipality?, assemblyLevel? }`
- `statements.semanticSearch`: 埋め込み生成 → pgvector cosine 類似度で topK 取得
  - input: `{ query, topK: number (default 5), filters?: { prefecture?, municipality?, assemblyLevel?, heldOnFrom?, heldOnTo? } }`

---

## 7. スクレイパー（`apps/scraper/`）

### 7.1 実行方法

```bash
# 国会議事録（NDL API）
bun run scrape --source ndl --from 2024-01 --until 2024-03

# 地方議会（設定ファイルベース）
bun run scrape --source local --prefecture 東京都 --municipality 千代田区
```

### 7.2 国会議事録スクレイパー（NDL API）

- 公式 API: `https://kokkai.ndl.go.jp/api/speech`
- `assembly_level = 'national'`, `prefecture = null`
- `external_id` = NDL の `speechID`（重複スキップ: `ON CONFLICT DO NOTHING`）

### 7.3 地方議会スクレイパー

- `scraper-targets.json` で各サイトの CSS セレクタを設定
  ```json
  {
    "prefecture": "東京都",
    "municipality": "千代田区",
    "baseUrl": "https://...",
    "listSelector": "ul.kaigiroku li a",
    "contentSelector": "div.honbun",
    "dateSelector": "span.kaigi-date"
  }
  ```
- `assembly_level = 'prefectural'` or `'municipal'`
- `cheerio` で HTML パース
- MVP では 1〜2 サイトのみ実装例を用意

### 7.4 注意事項

- NDL API: 過剰アクセス防止のため 500ms delay を挿入
- 地方議会サイト: HTML 構造が多様なため設定ファイルで外部化
- 発言分割はヒューリスティック（`○発言者：` パターン）

---

## 9. MVP 完成の定義（Done）

- スクレイピングで議事録を取り込み、検索で過去答弁が出る
- 都道府県・自治体名・日付範囲で絞り込みができる
- 質問入力で、**根拠 URL 付き**のドラフトが出る

---

## 10. 次の一手（MVP 後）

優先順おすすめ：

1. **スクレイピングの自動スケジューリング**（定期取得の自動化）
2. **承認フロー**（組織運用に乗せる）
3. **矛盾スコア**（ブレ検知の強化）
4. **政策自動分類**（タグ付けの地獄を終わらせる）
5. **地方議会スクレイパーの拡充**（対応サイト数を増やす）
