# Database Patterns

## DB Insert: id と created_at を省略する (CRITICAL)

Drizzle ORM でレコードを insert する際は、`id` と `created_at` を**必ず省略**する。

これらはスキーマで自動生成されるため、明示的に渡してはならない。

```ts
// ✅ CORRECT: id と created_at を省略
await db.insert(scraper_jobs).values({
  source: "ndl",
  status: "pending",
  config: { from: "2024-01", until: "2024-12" },
  processed_items: 0,
  total_inserted: 0,
  total_skipped: 0,
});

// ❌ WRONG: id や created_at を明示的に渡さない
await db.insert(scraper_jobs).values({
  id: createId(),           // ← NG: スキーマの $defaultFn が処理する
  created_at: new Date(),   // ← NG: スキーマの defaultNow() が処理する
  source: "ndl",
  ...
});
```

## id の生成には @paralleldrive/cuid2 を使用する

スキーマ定義で `id` フィールドに cuid2 を使う場合は `@paralleldrive/cuid2` の `createId` を使用する。

```ts
import { createId } from "@paralleldrive/cuid2";

export const some_table = pgTable("some_table", {
  id: text("id")
    .$defaultFn(() => createId())
    .primaryKey(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  // ...
});
```

- `uuid()` や `nanoid()` は使わず、必ず `createId()` を使う
- insert 時に `id` を手動で渡すのは禁止（スキーマの `$defaultFn` に任せる）

## 値が固定・変動しにくいカラムには enum を使う

取りうる値が確定していて変動が少ない場合は、`text` ではなく Drizzle の `pgEnum` を使ってスキーマレベルで制約する。

```ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ✅ CORRECT: 値が固定のカラムは enum で定義
export const scraperSourceEnum = pgEnum("scraper_source", ["ndl", "kagoshima", "local"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "running", "done", "failed"]);

export const scraper_jobs = pgTable("scraper_jobs", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  source: scraperSourceEnum("source").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ❌ WRONG: 固定値なのに text で定義すると不正な値を防げない
export const scraper_jobs_bad = pgTable("scraper_jobs", {
  source: text("source").notNull(),  // ← "ndl" 以外も入れられてしまう
  status: text("status").notNull(),
});
```

- enum を使うことで DB レベルで不正な値を防止できる
- TypeScript 型も自動で絞り込まれるため、アプリ側のバリデーションが容易になる
- 値の追加が頻繁に発生するカラムはマイグレーションコストが高まるため、その場合は `text` でも可

## マイグレーションファイルは手書き禁止 (CRITICAL)

マイグレーションファイル（`packages/db/src/migrations/*.sql`）は**必ず `drizzle-kit generate` で生成**する。手書きは絶対にしない。

```bash
# ✅ CORRECT: drizzle-kit で生成する
npx drizzle-kit generate

# ❌ WRONG: SQL ファイルを直接編集・手書きする
# Write/Edit ツールで .sql ファイルを作成・編集してはいけない
```

- `drizzle-kit generate --custom` も手書き前提なので使用禁止
- スキーマ変更後は必ず `drizzle-kit generate` を実行してマイグレーションを生成する
- インタラクティブな質問がある場合はユーザーに確認を求める
