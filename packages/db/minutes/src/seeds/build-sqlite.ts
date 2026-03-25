/**
 * NDJSON から SQLite シャードを生成するスクリプト
 *
 * packages/db/minutes/dbjson/ の meetings.ndjson / statements.ndjson を読み込み、
 * 8地方分類 + 年度単位で SQLite シャードを生成する。
 *
 * municipalities.csv から自治体マスタを読み、index.sqlite と各シャードに載せる。
 * meetings.ndjson の municipalityCode は団体コード（municipalities.code）と一致させる。
 *
 * 出力（R2 のファイル構成と一致）:
 *   packages/db/minutes/dbjson/index.sqlite            - 自治体マスタ
 *   packages/db/minutes/dbjson/minutes/{year}/{region}.db  - 会議・発言シャード
 *   packages/db/minutes/dbjson/manifest.json           - シャード一覧
 *
 * 使い方:
 *   bun run build:sqlite
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
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

// このスクリプトはローカルでしか使わないため、dotenvで読み込みを行なってOK
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const municipalitiesCsvPath = join(seedsDir, "data", "municipalities.csv");

const dbjsonDir = resolve(root, "packages/db/minutes/dbjson");
const meetingsPath = resolve(dbjsonDir, "meetings.ndjson");
const statementsPath = resolve(dbjsonDir, "statements.ndjson");

const migrationsFolder = resolve(seedsDir, "../migrations");

const STATEMENT_BATCH_SIZE = 2000;

// --- Types ---

type ShardContext = {
  db: Database;
  path: string;
  insertMeeting: ReturnType<Database["prepare"]>;
  insertStatement: ReturnType<Database["prepare"]>;
  insertFts: ReturnType<Database["prepare"]>;
  buffer: StatementNdjsonRow[];
};

// --- DB helpers ---

/**
 * Drizzle の `src/migrations/*.sql` をそのまま適用し、続けて FTS を用意する。
 * municipalities はマイグレーションで空テーブルができたあと、build 側で全件投入する。
 */
function initShardDb(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  db.run("PRAGMA journal_mode = WAL;");
  db.run("PRAGMA synchronous = NORMAL;");
  db.run("PRAGMA foreign_keys = ON;");
  const ddb = drizzle(db, { schema, casing: "snake_case" });
  migrate(ddb, { migrationsFolder });
  setupFts(ddb);
  return db;
}

function createShardContext(dbPath: string): ShardContext {
  const db = initShardDb(dbPath);
  return {
    db,
    path: dbPath,
    insertMeeting: db.prepare(
      "INSERT INTO meetings (id, created_at, updated_at, municipality_code, title, meeting_type, held_on, source_url, external_id, status, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    insertStatement: db.prepare(
      "INSERT OR IGNORE INTO statements (id, created_at, updated_at, meeting_id, kind, speaker_name, speaker_role, content, content_hash, start_offset, end_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    insertFts: db.prepare(
      "INSERT OR REPLACE INTO statements_fts (statement_id, bigrams) VALUES (?, ?)",
    ),
    buffer: [],
  };
}

function flushStatements(ctx: ShardContext, nowMs: number, force = false): void {
  if (!force && ctx.buffer.length < STATEMENT_BATCH_SIZE) return;
  if (ctx.buffer.length === 0) return;

  ctx.db.transaction(() => {
    for (const s of ctx.buffer) {
      ctx.insertStatement.run(
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
      );
      ctx.insertFts.run(s.id, tokenizeBigram(s.content));
    }
  })();

  ctx.buffer.length = 0;
}

/** シャード内で meetings と JOIN できるよう、自治体マスタを index と同内容で複製する */
function populateShardMunicipalities(db: Database, rows: MunicipalityRow[], nowMs: number): void {
  const stmt = db.prepare(
    "INSERT INTO municipalities (code, created_at, updated_at, name, prefecture, region_slug, base_url, enabled, population, population_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  db.transaction(() => {
    for (const m of rows) {
      stmt.run(
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
      );
    }
  })();
}

// --- Main ---

async function main() {
  if (!existsSync(municipalitiesCsvPath)) {
    console.error(`[build-sqlite] municipalities.csv が見つかりません: ${municipalitiesCsvPath}`);
    process.exit(1);
  }

  if (!existsSync(meetingsPath) || !existsSync(statementsPath)) {
    console.error(
      `[build-sqlite] meetings.ndjson または statements.ndjson が見つかりません: ${dbjsonDir}`,
    );
    console.error("  先に scrape:ndjson を実行してください。");
    process.exit(1);
  }

  const nowMs = Date.now();

  // 1. CSV のみ（minutes DB 不要。NDJSON の municipalityCode = 団体コード）
  console.log("[build-sqlite] municipalities.csv を読み込み中...");
  const pgMunicipalities = municipalityRowsFromCsv(municipalitiesCsvPath);
  const municipalityMap = new Map(pgMunicipalities.map((m) => [m.code, m]));
  console.log(`[build-sqlite] ${pgMunicipalities.length} 自治体`);

  // 2. index.sqlite を構築
  const indexDbPath = resolve(dbjsonDir, "index.sqlite");
  if (existsSync(indexDbPath)) unlinkSync(indexDbPath);
  console.log("[build-sqlite] index.sqlite を構築中...");

  const indexDb = new Database(indexDbPath, { create: true });
  indexDb.run("PRAGMA journal_mode = WAL;");
  indexDb.run(`
    CREATE TABLE municipalities (
      code TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      name TEXT NOT NULL,
      prefecture TEXT NOT NULL,
      region_slug TEXT NOT NULL,
      base_url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      population INTEGER,
      population_year INTEGER
    );
    CREATE INDEX municipalities_prefecture_idx ON municipalities (prefecture);
  `);
  const insertMunicipality = indexDb.prepare(
    "INSERT INTO municipalities (code, created_at, updated_at, name, prefecture, region_slug, base_url, enabled, population, population_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  indexDb.transaction(() => {
    for (const m of pgMunicipalities) {
      insertMunicipality.run(
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
      );
    }
  })();
  indexDb.close();
  console.log(`[build-sqlite] index.sqlite 完了 (${pgMunicipalities.length} 自治体)`);

  // 3. meetings.ndjson を読み込み、shardKey でグループ化
  console.log("[build-sqlite] meetings.ndjson を読み込み中...");
  const shardMeetings = new Map<string, MeetingNdjsonRow[]>();
  const meetingToShard = new Map<string, string>(); // meetingId -> "year/region"
  let totalMeetings = 0;
  let skippedMeetings = 0;

  for await (const line of createInterface({
    input: createReadStream(meetingsPath),
    crlfDelay: Infinity,
  })) {
    const m = parseMeetingNdjsonLine(line);
    if (!m) continue;
    const municipality = municipalityMap.get(m.municipalityCode);
    if (!municipality) {
      skippedMeetings++;
      continue;
    }
    const year = m.heldOn.slice(0, 4);
    const shardKey = `${year}/${municipality.regionSlug}`;

    let list = shardMeetings.get(shardKey);
    if (!list) {
      list = [];
      shardMeetings.set(shardKey, list);
    }
    list.push(m);
    meetingToShard.set(m.id, shardKey);
    totalMeetings++;
  }

  console.log(`[build-sqlite] ${totalMeetings} 会議読み込み完了 (${skippedMeetings} スキップ)`);
  console.log(`[build-sqlite] シャード: ${[...shardMeetings.keys()].sort().join(", ")}`);

  // 4. 各シャード DB を初期化し meetings を INSERT
  const shardContexts = new Map<string, ShardContext>();

  for (const [shardKey, meetings] of shardMeetings) {
    const [year, region] = shardKey.split("/") as [string, string];
    const shardDir = resolve(dbjsonDir, "minutes", year);
    if (!existsSync(shardDir)) mkdirSync(shardDir, { recursive: true });
    const shardPath = resolve(shardDir, `${region}.db`);
    if (existsSync(shardPath)) unlinkSync(shardPath);

    console.log(`[build-sqlite] シャード ${shardKey} を初期化中 (${meetings.length} 会議)...`);
    const ctx = createShardContext(shardPath);
    populateShardMunicipalities(ctx.db, pgMunicipalities, nowMs);
    shardContexts.set(shardKey, ctx);

    ctx.db.transaction(() => {
      for (const m of meetings) {
        ctx.insertMeeting.run(
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
        );
      }
    })();
  }

  // 5. statements.ndjson をストリームし、バッファ経由で INSERT + FTS
  console.log("[build-sqlite] statements.ndjson をストリーム中...");
  let totalStatements = 0;
  let skippedStatements = 0;

  for await (const line of createInterface({
    input: createReadStream(statementsPath),
    crlfDelay: Infinity,
  })) {
    const s = parseStatementNdjsonLine(line);
    if (!s) continue;
    const shardKey = meetingToShard.get(s.meetingId);
    if (!shardKey) {
      skippedStatements++;
      continue;
    }
    const ctx = shardContexts.get(shardKey)!;
    ctx.buffer.push(s);
    flushStatements(ctx, nowMs);
    totalStatements++;

    if (totalStatements % 100_000 === 0) {
      console.log(`[build-sqlite]   ${totalStatements.toLocaleString()} 発言処理済み...`);
    }
  }

  // 残バッファをフラッシュしてシャード DB をクローズ
  for (const ctx of shardContexts.values()) {
    flushStatements(ctx, nowMs, true);
    ctx.db.close();
  }

  console.log(
    `[build-sqlite] ${totalStatements.toLocaleString()} 発言 (${skippedStatements} スキップ)`,
  );

  // 6. manifest.json を生成
  console.log("[build-sqlite] manifest.json を生成中...");
  const manifest: {
    index: { path: string; size: number };
    minutes: Record<string, Record<string, Array<{ path: string; size: number }>>>;
  } = {
    index: { path: "index.sqlite", size: statSync(indexDbPath).size },
    minutes: {},
  };

  for (const [shardKey, ctx] of shardContexts) {
    const [year, region] = shardKey.split("/") as [string, string];
    if (!manifest.minutes[year]) manifest.minutes[year] = {};
    const relPath = `minutes/${year}/${region}.db`;
    manifest.minutes[year]![region] = [{ path: relPath, size: statSync(ctx.path).size }];
  }

  writeFileSync(resolve(dbjsonDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("[build-sqlite] 完了!");
  console.log(`  index.sqlite: ${pgMunicipalities.length} 自治体`);
  console.log(`  シャード数: ${shardContexts.size}`);
  console.log(
    `  合計: ${totalMeetings.toLocaleString()} 会議, ${totalStatements.toLocaleString()} 発言`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("[build-sqlite] Fatal error:", err);
  process.exit(1);
});
