/**
 * NDJSON から PostgreSQL DB にインサートするスクリプト
 *
 * data/minutes/ の meetings.ndjson / statements.ndjson を読み込み、
 * バッチ INSERT でデータベースに投入する。
 *
 * 使い方:
 *   DATABASE_URL="postgresql://..." bun run db:import
 *
 * - 直接 PostgreSQL 接続のため Supabase API 課金なし
 * - onConflictDoNothing で冪等（何度でも安全に再実行可能）
 * - ディレクトリ単位で処理し、成功ごとに _complete に imported フラグを立てる
 */

import { createReadStream, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import dotenv from "dotenv";
import { createDb, type Db } from "../src/index";
import { municipalities } from "../src/schema/municipalities";
import { meetings } from "../src/schema/meetings";
import { statements } from "../src/schema/statements";
import { parseMeetingNdjsonLine, type MeetingNdjsonRow } from "./parse-data/meetings";
import { parseStatementNdjsonLine, type StatementNdjsonRow } from "./parse-data/statements";
import { collectImportTargets } from "./utils/collect-import-targets";
import { markAsImported } from "./utils/complete-marker";
import { parseMunicipalitiesCsv } from "./utils/parse-municipalities-csv";

// --- Setup ---

const seedsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(seedsDir, "../../..");

dotenv.config({ path: resolve(root, ".env.local"), override: true });

const dataDir = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(root, "data/minutes");

const municipalitiesCsvPath = resolve(root, "data", "municipalities.csv");

const BATCH_SIZE = 100;

// --- Main ---

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[import] DATABASE_URL が設定されていません");
    process.exit(1);
  }

  const targets = collectImportTargets(dataDir);

  if (targets.length === 0) {
    console.log("[import] インポート対象のディレクトリがありません（_complete 未完了 or すべてインポート済み）");
    process.exit(0);
  }

  console.log(`[import] ${targets.length} ディレクトリの NDJSON を検出（未インポート）`);

  const db = createDb(databaseUrl);

  // 0. municipalities（FK 制約を満たすため先にインサート）
  if (existsSync(municipalitiesCsvPath)) {
    console.log("[import] municipalities.csv を読み込み中...");
    const municipalityRows = parseMunicipalitiesCsv(municipalitiesCsvPath);

    for (let i = 0; i < municipalityRows.length; i += BATCH_SIZE) {
      const chunk = municipalityRows.slice(i, i + BATCH_SIZE);
      await db.insert(municipalities).values(chunk).onConflictDoNothing();
    }
    console.log(`[import] ${municipalityRows.length} 自治体 INSERT 完了`);
  }

  // ディレクトリ単位で処理
  let totalDirs = 0;
  let failedDirs = 0;

  for (const target of targets) {
    const label = target.codeDir.replace(dataDir + "/", "");
    try {
      await importDirectory(db, target.meetingsPath, target.statementsPath, label);
      markAsImported(target.codeDir);
      totalDirs++;
      console.log(`[import] ✓ ${label} インポート完了・フラグ記録`);
    } catch (err) {
      failedDirs++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[import] ✗ ${label} 失敗: ${msg.slice(0, 300)}`);
    }
  }

  console.log("[import] 完了!");
  console.log(`  成功: ${totalDirs} ディレクトリ`);
  if (failedDirs > 0) {
    console.log(`  失敗: ${failedDirs} ディレクトリ`);
  }

  process.exit(failedDirs > 0 ? 1 : 0);
}

async function importDirectory(
  db: Db,
  meetingsPath: string,
  statementsPath: string | null,
  label: string,
): Promise<void> {
  // 1. meetings
  const insertedMeetingIds = new Set<string>();
  const allKnownMeetingIds = new Set<string>();
  let totalMeetings = 0;
  let meetingBatch: MeetingNdjsonRow[] = [];

  for await (const line of createInterface({
    input: createReadStream(meetingsPath),
    crlfDelay: Infinity,
  })) {
    const m = parseMeetingNdjsonLine(line);
    if (!m) continue;
    allKnownMeetingIds.add(m.id);
    if (!m.heldOn) continue;
    meetingBatch.push(m);
    totalMeetings++;

    if (meetingBatch.length >= BATCH_SIZE) {
      const inserted = await insertMeetings(db, meetingBatch);
      for (const id of inserted) insertedMeetingIds.add(id);
      meetingBatch = [];
    }
  }
  if (meetingBatch.length > 0) {
    const inserted = await insertMeetings(db, meetingBatch);
    for (const id of inserted) insertedMeetingIds.add(id);
  }

  if (!statementsPath) return;

  // 2. statements の事前検証（不正 meetingId チェック）
  let corrupted = false;
  for await (const line of createInterface({
    input: createReadStream(statementsPath),
    crlfDelay: Infinity,
  })) {
    const s = parseStatementNdjsonLine(line);
    if (!s) continue;
    if (!allKnownMeetingIds.has(s.meetingId)) {
      corrupted = true;
      break;
    }
  }

  if (corrupted) {
    console.log(`[import]   ${label}: 存在しない meetingId を検出 → NDJSON 削除`);
    unlinkSync(statementsPath);
    if (existsSync(meetingsPath)) unlinkSync(meetingsPath);
    return;
  }

  // 3. statements
  let totalStatements = 0;
  let stmtBatch: StatementNdjsonRow[] = [];

  for await (const line of createInterface({
    input: createReadStream(statementsPath),
    crlfDelay: Infinity,
  })) {
    const s = parseStatementNdjsonLine(line);
    if (!s) continue;
    if (!insertedMeetingIds.has(s.meetingId)) continue;
    stmtBatch.push(s);
    totalStatements++;

    if (stmtBatch.length >= BATCH_SIZE) {
      await insertStatements(db, stmtBatch);
      stmtBatch = [];
    }
  }
  if (stmtBatch.length > 0) {
    await insertStatements(db, stmtBatch);
  }

  console.log(`[import]   ${label}: ${totalMeetings} 会議, ${totalStatements} 発言`);
}

async function insertMeetings(db: Db, rows: MeetingNdjsonRow[]): Promise<string[]> {
  const result = await db
    .insert(meetings)
    .values(
      rows.map((m) => ({
        id: m.id,
        municipalityCode: m.municipalityCode,
        title: m.title,
        meetingType: m.meetingType,
        heldOn: m.heldOn,
        sourceUrl: m.sourceUrl ?? null,
        externalId: m.externalId ?? null,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: meetings.id });
  return result.map((r) => r.id);
}

async function insertStatements(db: Db, rows: StatementNdjsonRow[]): Promise<void> {
  await db
    .insert(statements)
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
}

main().catch((err) => {
  console.error("[import] Fatal error:", err);
  process.exit(1);
});
