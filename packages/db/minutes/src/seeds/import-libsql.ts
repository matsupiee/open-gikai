/**
 * NDJSON から単一 libSQL DB にインポートするスクリプト
 *
 * packages/db/minutes/dbjson/ の meetings.ndjson / statements.ndjson を読み込み、
 * 単一の SQLite DB にインポートする。
 *
 * 使い方:
 *   bun run db:import
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createReadStream, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { setupFts, tokenizeBigram } from "../fts/index";
import dotenv from "dotenv";
import * as schema from "../schema";
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

  const nowMs = Date.now();

  // 1. municipalities
  console.log("[import-libsql] municipalities.csv を読み込み中...");
  const municipalityRows = municipalityRowsFromCsv(municipalitiesCsvPath);
  console.log(`[import-libsql] ${municipalityRows.length} 自治体`);

  await insertMunicipalities(client, municipalityRows, nowMs);
  console.log(`[import-libsql] ${municipalityRows.length} 自治体 INSERT 完了`);

  // 2. meetings
  console.log("[import-libsql] meetings.ndjson を読み込み中...");
  let totalMeetings = 0;
  let batch: MeetingNdjsonRow[] = [];

  for await (const line of createInterface({
    input: createReadStream(meetingsPath),
    crlfDelay: Infinity,
  })) {
    const m = parseMeetingNdjsonLine(line);
    if (!m) continue;
    batch.push(m);
    totalMeetings++;

    if (batch.length >= BATCH_SIZE) {
      await insertMeetings(client, batch, nowMs);
      batch = [];
    }
  }
  if (batch.length > 0) await insertMeetings(client, batch, nowMs);
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
      await insertStatements(client, stmtBatch, nowMs);
      stmtBatch = [];
    }
  }
  if (stmtBatch.length > 0) await insertStatements(client, stmtBatch, nowMs);
  console.log(`[import-libsql] ${totalStatements} 発言 INSERT 完了`);

  console.log("[import-libsql] 完了!");
  console.log(`  DB: ${dbPath}`);
  console.log(`  自治体: ${municipalityRows.length}`);
  console.log(`  会議: ${totalMeetings}`);
  console.log(`  発言: ${totalStatements}`);

  process.exit(0);
}

async function insertMunicipalities(
  client: Client,
  rows: MunicipalityRow[],
  nowMs: number,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await client.batch(
      chunk.map((m) => ({
        sql: "INSERT INTO municipalities (code, created_at, updated_at, name, prefecture, region_slug, base_url, enabled, population, population_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          m.code,
          nowMs,
          nowMs,
          m.name,
          m.prefecture,
          m.regionSlug,
          m.baseUrl || null,
          m.enabled ? 1 : 0,
          m.population ?? null,
          m.populationYear ?? null,
        ],
      })),
    );
  }
}

async function insertMeetings(
  client: Client,
  rows: MeetingNdjsonRow[],
  nowMs: number,
): Promise<void> {
  await client.batch(
    rows.map((m) => ({
      sql: "INSERT INTO meetings (id, created_at, updated_at, municipality_code, title, meeting_type, held_on, source_url, external_id, status, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        m.id,
        nowMs,
        nowMs,
        m.municipalityCode,
        m.title,
        m.meetingType,
        m.heldOn,
        m.sourceUrl ?? null,
        m.externalId ?? null,
        m.status,
        m.scrapedAt ? new Date(m.scrapedAt).getTime() : null,
      ],
    })),
  );
}

async function insertStatements(
  client: Client,
  rows: StatementNdjsonRow[],
  nowMs: number,
): Promise<void> {
  const stmts = rows.flatMap((s) => [
    {
      sql: "INSERT OR IGNORE INTO statements (id, created_at, updated_at, meeting_id, kind, speaker_name, speaker_role, content, content_hash, start_offset, end_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        s.id,
        nowMs,
        nowMs,
        s.meetingId,
        s.kind,
        s.speakerName ?? null,
        s.speakerRole ?? null,
        s.content,
        s.contentHash,
        s.startOffset ?? null,
        s.endOffset ?? null,
      ],
    },
    {
      sql: "INSERT OR REPLACE INTO statements_fts (statement_id, bigrams) VALUES (?, ?)",
      args: [s.id, tokenizeBigram(s.content)],
    },
  ]);
  await client.batch(stmts);
}

main().catch((err) => {
  console.error("[import-libsql] Fatal error:", err);
  process.exit(1);
});
