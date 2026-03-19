/**
 * 既存の processed 会議に対して statement_chunks を遡及的に作成するスクリプト。
 * 使い方: bun src/utils/backfill-chunks.ts
 */
import { createDb } from "@open-gikai/db";
import { env } from "@open-gikai/env/db";
import { buildPendingChunks } from "./build-chunks";

const db = createDb(env.DATABASE_URL);
console.log("[backfill] Starting...");
await buildPendingChunks(db, process.env.OPENAI_API_KEY, 200);
console.log("[backfill] Done.");
process.exit(0);
