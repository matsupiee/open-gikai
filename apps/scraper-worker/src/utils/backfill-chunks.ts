/**
 * 既存の processed 会議に対して statement_chunks を遡及的に作成するスクリプト。
 * 使い方: bun --env-file ../web/.env src/utils/backfill-chunks.ts
 */
import { createDb } from "@open-gikai/db";
import { buildPendingChunks } from "./build-chunks";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[backfill] DATABASE_URL is required");
  process.exit(1);
}

const db = createDb(DATABASE_URL);
console.log("[backfill] Starting...");
await buildPendingChunks(db, process.env.OPENAI_API_KEY, 200);
console.log("[backfill] Done.");
process.exit(0);
