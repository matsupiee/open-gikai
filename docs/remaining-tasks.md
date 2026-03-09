# 残タスク一覧

## 完了済み

- [x] Phase 1: DBスキーマ拡張（meetings, statements, policy_tags, statement_policy_tags）
- [x] Phase 1: pgvector有効化 + `bun run db:push` 適用済み
- [x] Phase 2: 環境変数 `OPENAI_API_KEY` をオプション追加（`packages/env/src/server.ts`）
- [x] Phase 3-1: `packages/api/src/services/embedding.ts`（OpenAI text-embedding-3-small）
- [x] Phase 3-2: `packages/api/src/services/statement-processing.ts`（発言分割・埋め込み生成）
- [x] Phase 3.5: `apps/scraper/`（NDLスクレイパー + 地方議会スクレイパー + DB書き込み）
- [x] Phase 4-1: `packages/api/src/routers/meetings.ts`（一覧・取得・手動再処理）
- [x] Phase 4-2: `packages/api/src/routers/statements.ts`（全文検索・ベクトル検索）
- [x] Phase 5-1: `apps/web/src/routes/meetings/index.tsx`（議事録ブラウザ）
- [x] Phase 5-2: `apps/web/src/routes/search/index.tsx`（答弁検索）
- [x] 開発サーバー起動（`bun dev` → http://localhost:4030）

---

## 未実装・残タスク

### 1. ドラフト生成サービス（Phase 3-3）

**ファイル:** `packages/api/src/services/draft-generation.ts`

- OpenAI Chat API（gpt-4.1-mini）を使ってドラフトを生成
- 提示したsource以外の主張を禁止するプロンプト設計
- 根拠がない場合は「確認中」と明示
- 出力: 回答本文 + 番号付き根拠（URL/会議/日付/発言者）
- `prompt_version = "v1"` で固定（再現性確保）

---

### 2. ドラフトAPIルーター（Phase 4-3）

**ファイル:** `packages/api/src/routers/drafts.ts`

- `drafts.create`: semanticSearch → draft生成 → DB保存（drafts + draft_references）
- `drafts.list`: ユーザー別・日付範囲フィルタ
- `drafts.get`: ID + draft_references（statements, meetingsをJOIN）

また、`packages/api/src/routers/index.ts` に drafts ルーターを登録する。

> 注意: 現状 `drafts` テーブルと `draft_references` テーブルはスキーマ定義済みだが、マイグレーション未適用の可能性あり。確認が必要。

---

### 3. 回答案作成ページ（Phase 5-3）

**ファイル:** `apps/web/src/routes/drafts/index.tsx`

- 質問入力テキストエリア
- 「候補を表示」→ 類似答弁topK表示（根拠URL付き）
- 「この根拠で生成」ボタン
- 生成結果表示: 回答本文 + 番号付き根拠リスト
- 保存済みドラフト一覧

ナビゲーションに「回答案作成」リンクを追加（`apps/web/src/routes/__root.tsx` または ナビコンポーネント）。

---

### 4. 環境変数の設定

**ファイル:** `apps/web/.env`

```
OPENAI_API_KEY=sk-...
```

- 埋め込み生成・ドラフト生成に必要
- 設定しないと Phase 3-1〜3-3 の機能が動作しない

---

### 5. スクレイパーのlockfile修正

```bash
cd /path/to/open-gikai
bun install
```

`apps/scraper` パッケージが workspace lockfile に未登録の状態（警告が出ている）。
`bun install` を一度実行して lockfile を更新する。

---

### 6. エンドツーエンド動作確認

スクレイピングと埋め込み生成は分離されているため、段階的に確認できる。

#### Step A: スクレイピング（OPENAI_API_KEY 不要）
1. NDLスクレイパーを実行して議事録データを取り込み:
   ```bash
   cd apps/scraper
   bun run scrape --source ndl --from 2024-01 --until 2024-03
   ```
2. DBで `meetings` に `status: "pending"` のデータが入ったことを確認
3. http://localhost:4030/meetings で一覧表示を確認（ステータス "pending"）

#### Step B: 埋め込み生成（OPENAI_API_KEY 必要）
4. `OPENAI_API_KEY` を `.env` に設定
5. 議事録詳細画面から「処理を実行」または `transcripts.process` APIを呼んで埋め込み生成
6. DBで `statements` にデータが入り、`meetings.status` が `done` になったことを確認

#### Step C: 検索・ドラフト生成（Phase 3-3完了後）
7. http://localhost:4030/search でキーワード検索・類似検索を確認
8. http://localhost:4030/drafts で質問入力 → ドラフト生成を確認
9. DBで `drafts` と `draft_references` にデータが保存されたことを確認

---

## 優先順位

| 優先度 | タスク |
|--------|--------|
| 高 | 4. `OPENAI_API_KEY` 設定 |
| 高 | 1. draft-generation サービス実装 |
| 高 | 2. drafts ルーター実装 |
| 高 | 3. 回答案作成ページ実装 |
| 中 | 5. スクレイパー lockfile 修正 |
| 中 | 6. エンドツーエンド動作確認 |
