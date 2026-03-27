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
 */

import {
  createReadStream,
  readFileSync,
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
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

/**
 * data/minutes/ 配下の {year}/{municipalityCode}/ ディレクトリを走査し、
 * 全 NDJSON ファイルのパスを収集する。
 */
function collectNdjsonPaths(): {
  meetingsPaths: string[];
  statementsPaths: string[];
} {
  const meetingsPaths: string[] = [];
  const statementsPaths: string[] = [];

  if (!existsSync(dataDir)) return { meetingsPaths, statementsPaths };

  for (const yearEntry of readdirSync(dataDir)) {
    const yearDir = resolve(dataDir, yearEntry);
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[import] DATABASE_URL が設定されていません");
    process.exit(1);
  }

  const { meetingsPaths, statementsPaths } = collectNdjsonPaths();

  if (meetingsPaths.length === 0) {
    console.error(`[import] NDJSON ファイルが見つかりません: ${dataDir}/{year}/{code}/`);
    console.error("  先に scrape:ndjson を実行してください。");
    process.exit(1);
  }

  console.log(`[import] ${meetingsPaths.length} ディレクトリの NDJSON を検出`);

  const db = createDb(databaseUrl);

  // 0. municipalities（FK 制約を満たすため先にインサート）
  if (existsSync(municipalitiesCsvPath)) {
    console.log("[import] municipalities.csv を読み込み中...");
    const csvContent = readFileSync(municipalitiesCsvPath, "utf-8");
    const csvLines = csvContent.split(/\r?\n/).slice(1);
    const municipalityRows = csvLines.flatMap((line) => {
      if (!line.trim()) return [];
      const cols = line.split(",");
      const code = cols[0]?.trim() ?? "";
      const prefecture = cols[1]?.replace(/"/g, "").trim() ?? "";
      const name = cols[2]?.replace(/"/g, "").trim() || prefecture;
      const baseUrl = cols[5]?.replace(/"/g, "").trim() || null;
      const populationRaw = cols[6]?.replace(/"/g, "").trim();
      const populationYearRaw = cols[7]?.replace(/"/g, "").trim();
      const population = populationRaw ? parseInt(populationRaw, 10) || null : null;
      const populationYear = populationYearRaw ? parseInt(populationYearRaw, 10) || null : null;
      return [{ code, name, prefecture, baseUrl, population, populationYear }];
    });

    for (let i = 0; i < municipalityRows.length; i += BATCH_SIZE) {
      const chunk = municipalityRows.slice(i, i + BATCH_SIZE);
      await db.insert(municipalities).values(chunk).onConflictDoNothing();
    }
    console.log(`[import] ${municipalityRows.length} 自治体 INSERT 完了`);
  }

  // 1. meetings（全ディレクトリを順に読み込み）
  // heldOn が null の会議はスキップし、そのIDを記録して statements でもフィルタする
  console.log("[import] meetings.ndjson を読み込み中...");
  const insertedMeetingIds = new Set<string>();
  const skippedMeetingIds = new Set<string>();
  // 全 meetings.ndjson に存在する meetingId を記録（FK 検証用）
  const allKnownMeetingIds = new Set<string>();
  let totalMeetings = 0;
  let meetingBatch: MeetingNdjsonRow[] = [];

  for (const filePath of meetingsPaths) {
    for await (const line of createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    })) {
      const m = parseMeetingNdjsonLine(line);
      if (!m) continue;
      allKnownMeetingIds.add(m.id);
      if (!m.heldOn) {
        skippedMeetingIds.add(m.id);
        continue;
      }
      meetingBatch.push(m);
      totalMeetings++;

      if (meetingBatch.length >= BATCH_SIZE) {
        const inserted = await insertMeetings(db, meetingBatch);
        for (const id of inserted) insertedMeetingIds.add(id);
        meetingBatch = [];
      }
    }
  }
  if (meetingBatch.length > 0) {
    const inserted = await insertMeetings(db, meetingBatch);
    for (const id of inserted) insertedMeetingIds.add(id);
  }
  const duplicateMeetings = totalMeetings - insertedMeetingIds.size;
  console.log(
    `[import] ${insertedMeetingIds.size} 会議 INSERT 完了（${totalMeetings} 件中、重複 ${duplicateMeetings} 件スキップ）`,
  );
  if (skippedMeetingIds.size > 0) {
    console.log(`[import] ${skippedMeetingIds.size} 会議スキップ（heldOn が null）`);
  }

  // 2. statements の事前スキャン
  // allKnownMeetingIds に存在しない meetingId を含むファイルを特定し、
  // そのファイル（自治体）をまるごとスキップ＆削除する
  console.log("[import] statements.ndjson を検証中...");
  const corruptedStatementFiles = new Set<string>();

  for (const filePath of statementsPaths) {
    for await (const line of createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    })) {
      const s = parseStatementNdjsonLine(line);
      if (!s) continue;
      if (!allKnownMeetingIds.has(s.meetingId)) {
        corruptedStatementFiles.add(filePath);
        break;
      }
    }
  }

  // 不正な meetingId を含む NDJSON ファイルを削除
  if (corruptedStatementFiles.size > 0) {
    console.log(
      `[import] ${corruptedStatementFiles.size} ファイルに存在しない meetingId を検出 → 削除します`,
    );
    for (const statementsFile of corruptedStatementFiles) {
      const meetingsFile = resolve(dirname(statementsFile), "meetings.ndjson");
      console.log(`[import]   削除: ${statementsFile}`);
      unlinkSync(statementsFile);
      if (existsSync(meetingsFile)) {
        console.log(`[import]   削除: ${meetingsFile}`);
        unlinkSync(meetingsFile);
      }
    }
  }

  // 3. statements（検証済みファイルのみ読み込み）
  const validStatementsPaths = statementsPaths.filter((p) => !corruptedStatementFiles.has(p));
  console.log("[import] statements.ndjson を読み込み中...");
  let totalStatements = 0;
  let skippedStatements = 0;
  let failedBatches = 0;
  let stmtBatch: StatementNdjsonRow[] = [];

  for (const filePath of validStatementsPaths) {
    for await (const line of createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    })) {
      const s = parseStatementNdjsonLine(line);
      if (!s) continue;
      if (!insertedMeetingIds.has(s.meetingId)) {
        skippedStatements++;
        continue;
      }
      stmtBatch.push(s);
      totalStatements++;

      if (stmtBatch.length >= BATCH_SIZE) {
        const ok = await insertStatements(db, stmtBatch);
        if (!ok) failedBatches++;
        stmtBatch = [];
      }
    }
  }
  if (stmtBatch.length > 0) {
    const ok = await insertStatements(db, stmtBatch);
    if (!ok) failedBatches++;
  }
  console.log(`[import] ${totalStatements} 発言 INSERT 完了`);
  if (skippedStatements > 0) {
    console.log(`[import] ${skippedStatements} 発言スキップ（会議が除外済み）`);
  }
  if (failedBatches > 0) {
    console.log(`[import] ${failedBatches} バッチ失敗（FK 違反等）`);
  }

  console.log("[import] 完了!");
  console.log(`  会議: ${totalMeetings}`);
  console.log(`  発言: ${totalStatements}`);

  process.exit(0);
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

async function insertStatements(db: Db, rows: StatementNdjsonRow[]): Promise<boolean> {
  try {
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
    return true;
  } catch (err: unknown) {
    const cause =
      err && typeof err === "object" && "cause" in err ? (err as { cause: unknown }).cause : err;
    const msg = cause instanceof Error ? cause.message : String(cause);
    console.warn(`[import] バッチ INSERT 失敗（${rows.length}件）: ${msg.slice(0, 300)}`);
    return false;
  }
}

main().catch((err) => {
  console.error("[import] Fatal error:", err);
  process.exit(1);
});
