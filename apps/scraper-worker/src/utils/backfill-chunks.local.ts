/**
 * 既存の processed 会議に対して statement_chunks を遡及的に作成するスクリプト。
 * 使い方: bun src/utils/backfill-chunks.ts
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createDb } from "@open-gikai/db";
import { buildPendingChunks } from "./build-chunks";

const root = resolve(fileURLToPath(import.meta.url), "../../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const db = createDb(process.env.DATABASE_URL!);
console.log("[backfill] Starting...");
await buildPendingChunks(db, process.env.OPENAI_API_KEY, 200);
console.log("[backfill] Done.");
process.exit(0);
