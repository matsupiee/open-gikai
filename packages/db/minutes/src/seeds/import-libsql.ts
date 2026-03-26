/**
 * NDJSON から単一 libSQL DB にインポートするスクリプト
 *
 * data/minutes/ の meetings.ndjson / statements.ndjson を読み込み、
 * 単一の SQLite DB にインポートする。
 *
 * 使い方:
 *   bun run db:import
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { sql } from "drizzle-orm";
import { createReadStream, existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { tokenizeBigram } from "../fts/index";
import dotenv from "dotenv";
import * as schema from "../schema";
import type { MinutesDb } from "../client";
import { municipalityRowsFromCsv } from "./parse-data/municipalities";
import { parseMeetingNdjsonLine, type MeetingNdjsonRow } from "./parse-data/meetings";
import { parseStatementNdjsonLine, type StatementNdjsonRow } from "./parse-data/statements";

// --- Setup ---

const seedsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(seedsDir, "../../../../../");

dotenv.config({ path: resolve(root, ".env.local"), override: true });

const municipalitiesCsvPath = resolve(seedsDir, "data", "municipalities.csv");

const dbjsonDir = resolve(root, "data/minutes");
const dbPath = resolve(dbjsonDir, "minutes.db");

const migrationsFolder = resolve(seedsDir, "../migrations");

const BATCH_SIZE = 100;

// --- Main ---

/**
 * data/minutes/ 配下の {year}/{municipalityCode}/ ディレクトリを走査し、
 * 全 NDJSON ファイルのパスを収集する。
 */
function collectNdjsonPaths(): { meetingsPaths: string[]; statementsPaths: string[] } {
  const meetingsPaths: string[] = [];
  const statementsPaths: string[] = [];

  if (!existsSync(dbjsonDir)) return { meetingsPaths, statementsPaths };

  for (const yearEntry of readdirSync(dbjsonDir)) {
    const yearDir = resolve(dbjsonDir, yearEntry);
    if (!statSync(yearDir).isDirectory() || !/^\d{4}$/.test(yearEntry)) continue;

    for (const codeEntry of readdirSync(yearDir)) {
      const codeDir = resolve(yearDir, codeEntry);
      if (!statSync(codeDir).isDirectory()) continue;

      const mp = resolve(codeDir, "meetings.ndjson");
      const sp = resolve(codeDir, "statements.ndjson");
      if (existsSync(mp)) meetingsPaths.push(mp);
      if (existsSync(sp)) statementsPaths.push(sp);
    }
  }

  return { meetingsPaths, statementsPaths };
}

async function main() {
  if (!existsSync(municipalitiesCsvPath)) {
    console.error(`[import-libsql] municipalities.csv が見つかりません: ${municipalitiesCsvPath}`);
    process.exit(1);
  }

  const { meetingsPaths, statementsPaths } = collectNdjsonPaths();

  if (meetingsPaths.length === 0) {
    console.error(`[import-libsql] NDJSON ファイルが見つかりません: ${dbjsonDir}/{year}/{code}/`);
    console.error("  先に scrape:ndjson を実行してください。");
    process.exit(1);
  }

  console.log(`[import-libsql] ${meetingsPaths.length} ディレクトリの NDJSON を検出`);

  // 既存 DB を削除して再作成
  for (const suffix of ["", "-shm", "-wal"]) {
    const p = dbPath + suffix;
    if (existsSync(p)) unlinkSync(p);
  }

  console.log("[import-libsql] DB を初期化中...");
  const client = createClient({ url: `file:${dbPath}` });
  const db = drizzle(client, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder });

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

  // 2. meetings（全ディレクトリを順に読み込み）
  console.log("[import-libsql] meetings.ndjson を読み込み中...");
  let totalMeetings = 0;
  let meetingBatch: MeetingNdjsonRow[] = [];

  for (const filePath of meetingsPaths) {
    for await (const line of createInterface({
      input: createReadStream(filePath),
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
  }
  if (meetingBatch.length > 0) await insertMeetings(db, meetingBatch);
  console.log(`[import-libsql] ${totalMeetings} 会議 INSERT 完了`);

  // 3. statements + FTS（全ディレクトリを順に読み込み）
  console.log("[import-libsql] statements.ndjson を読み込み中...");
  let totalStatements = 0;
  let stmtBatch: StatementNdjsonRow[] = [];

  for (const filePath of statementsPaths) {
    for await (const line of createInterface({
      input: createReadStream(filePath),
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
