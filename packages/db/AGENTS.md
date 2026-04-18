# packages/db

## 責務

Drizzle ORM によるスキーマ・マイグレーション・seeds。リポジトリで唯一 DB スキーマを定義する場所。

## 依存

使ってよい:
- `drizzle-orm`, `postgres`, `pg`
- `@paralleldrive/cuid2` — `id` 生成
- `zod`

使わない:
- ビジネスロジック・認証判定・API レイヤーの責務をここに持ち込まない

## 公開入口

- `src/index.ts` — クライアント生成（`createDb`）
- `src/schema/` — テーブル定義
  - `auth.ts` / `meetings.ts` / `municipalities.ts` / `statements.ts`
- `src/migrations/` — **生成されたマイグレーション（手書き禁止）**
- `seeds/` — 初期データ投入スクリプト
- `test/` — `@open-gikai/db/test-helpers`（テスト用トランザクションヘルパー）

## 開発

```bash
bun run db:start
bun run db:generate      # スキーマ変更後に必ず実行
bun run db:migrate
bun run --cwd packages/db test
```

## 必読ルール

`.claude/rules/database-patterns.md` に以下が書かれている。必ず読む。

- `id` と `created_at` は insert 時に渡さない（`$defaultFn` / `defaultNow()` が処理）
- `id` は `@paralleldrive/cuid2` の `createId()` を使う（uuid/nanoid 禁止）
- 値が固定・変動しにくいカラムは `pgEnum` で定義
- **マイグレーションは `drizzle-kit generate` で生成。手書き絶対禁止**

## 禁止事項

- `src/migrations/*.sql` を Edit/Write しない（`drizzle-kit generate` のみ）
- スキーマを `apps/*` や他 package に重複定義しない
