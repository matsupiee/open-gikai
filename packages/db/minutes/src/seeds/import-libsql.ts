/**
 * NDJSON から単一 libSQL DB にインポートするスクリプト
 *
 * packages/db/minutes/dbjson/ の meetings.ndjson / statements.ndjson を読み込み、
 * 単一の SQLite DB にインポートする。
 *
 * 使い方:
 *   bun run db:import
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { createReadStream, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { setupFts, tokenizeBigram } from "../fts/index";
import dotenv from "dotenv";
import * as schema from "../schema";
import type { MinutesDb } from "../client";
import { municipalityRowsFromCsv, type MunicipalityRow } from "./parse-data/municipalities";
import { parseMeetingNdjsonLine, type MeetingNdjsonRow } from "./parse-data/meetings";
import { parseStatementNdjsonLine, type StatementNdjsonRow } from "./parse-data/statements";

// --- Setup ---

const seedsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(seedsDir, "../../../../../");

dotenv.config({ path: resolve(root, ".env.local"), override: true });

const municipalitiesCsvPath = resolve(seedsDir, "data", "municipalities.csv");

const dbjsonDir = resolve(root, "packages/db/minutes/dbjson");
const meetingsPath = resolve(dbjsonDir, "meetings.ndjson");
const statementsPath = resolve(dbjsonDir, "statements.ndjson");
const dbPath = resolve(dbjsonDir, "minutes.db");

const migrationsFolder = resolve(seedsDir, "../migrations");

const BATCH_SIZE = 100;

// --- Main ---

async function main() {
  if (!existsSync(municipalitiesCsvPath)) {
    console.error(`[import-libsql] municipalities.csv が見つかりません: ${municipalitiesCsvPath}`);
    process.exit(1);
  }

  if (!existsSync(meetingsPath) || !existsSync(statementsPath)) {
    console.error(
      `[import-libsql] meetings.ndjson または statements.ndjson が見つかりません: ${dbjsonDir}`,
    );
    console.error("  先に scrape:ndjson を実行してください。");
    process.exit(1);
  }

  // 既存 DB を削除して再作成
  for (const suffix of ["", "-shm", "-wal"]) {
    const p = dbPath + suffix;
    if (existsSync(p)) unlinkSync(p);
  }

  console.log("[import-libsql] DB を初期化中...");
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });
  await setupFts(db);

  // 1. municipalities
  console.log("[import-libsql] municipalities.csv を読み込み中...");
  const municipalityRows = municipalityRowsFromCsv(municipalitiesCsvPath);
  console.log(`[import-libsql] ${municipalityRows.length} 自治体`);

  for (let i = 0; i < municipalityRows.length; i += BATCH_SIZE) {
    const chunk = municipalityRows.slice(i, i + BATCH_SIZE);
    await db.insert(schema.municipalities).values(
      chunk.map((m) => ({
        code: m.code,
        name: m.name,
        prefecture: m.prefecture,
        regionSlug: m.regionSlug,
        baseUrl: m.baseUrl || null,
        enabled: m.enabled,
        population: m.population ?? null,
        populationYear: m.populationYear ?? null,
      })),
    );
  }
  console.log(`[import-libsql] ${municipalityRows.length} 自治体 INSERT 完了`);

  // 2. meetings
  console.log("[import-libsql] meetings.ndjson を読み込み中...");
  let totalMeetings = 0;
  let meetingBatch: MeetingNdjsonRow[] = [];

  for await (const line of createInterface({
    input: createReadStream(meetingsPath),
    crlfDelay: Infinity,
  })) {
    const m = parseMeetingNdjsonLine(line);
    if (!m) continue;
    meetingBatch.push(m);
    totalMeetings++;

    if (meetingBatch.length >= BATCH_SIZE) {
      await insertMeetings(db, meetingBatch);
      meetingBatch = [];
    }
  }
  if (meetingBatch.length > 0) await insertMeetings(db, meetingBatch);
  console.log(`[import-libsql] ${totalMeetings} 会議 INSERT 完了`);

  // 3. statements + FTS
  console.log("[import-libsql] statements.ndjson を読み込み中...");
  let totalStatements = 0;
  let stmtBatch: StatementNdjsonRow[] = [];

  for await (const line of createInterface({
    input: createReadStream(statementsPath),
    crlfDelay: Infinity,
  })) {
    const s = parseStatementNdjsonLine(line);
    if (!s) continue;
    stmtBatch.push(s);
    totalStatements++;

    if (stmtBatch.length >= BATCH_SIZE) {
      await insertStatements(db, stmtBatch);
      stmtBatch = [];
    }
  }
  if (stmtBatch.length > 0) await insertStatements(db, stmtBatch);
  console.log(`[import-libsql] ${totalStatements} 発言 INSERT 完了`);

  console.log("[import-libsql] 完了!");
  console.log(`  DB: ${dbPath}`);
  console.log(`  自治体: ${municipalityRows.length}`);
  console.log(`  会議: ${totalMeetings}`);
  console.log(`  発言: ${totalStatements}`);

  process.exit(0);
}

async function insertMeetings(db: MinutesDb, rows: MeetingNdjsonRow[]): Promise<void> {
  await db.insert(schema.meetings).values(
    rows.map((m) => ({
      id: m.id,
      municipalityCode: m.municipalityCode,
      title: m.title,
      meetingType: m.meetingType,
      heldOn: m.heldOn,
      sourceUrl: m.sourceUrl ?? null,
      externalId: m.externalId ?? null,
      status: m.status,
      scrapedAt: m.scrapedAt ? new Date(m.scrapedAt) : null,
    })),
  );
}

async function insertStatements(db: MinutesDb, rows: StatementNdjsonRow[]): Promise<void> {
  await db
    .insert(schema.statements)
    .values(
      rows.map((s) => ({
        id: s.id,
        meetingId: s.meetingId,
        kind: s.kind,
        speakerName: s.speakerName ?? null,
        speakerRole: s.speakerRole ?? null,
        content: s.content,
        contentHash: s.contentHash,
        startOffset: s.startOffset ?? null,
        endOffset: s.endOffset ?? null,
      })),
    )
    .onConflictDoNothing();

  // FTS インデックスの投入（Drizzle は FTS5 virtual table をサポートしていないため raw SQL）
  for (const s of rows) {
    await db.run(
      sql`INSERT OR REPLACE INTO statements_fts (statement_id, bigrams) VALUES (${s.id}, ${tokenizeBigram(s.content)})`,
    );
  }
}

main().catch((err) => {
  console.error("[import-libsql] Fatal error:", err);
  process.exit(1);
});
