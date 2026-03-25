/**
 * NDJSON から SQLite シャードを生成するスクリプト
 *
 * packages/db/minutes/dbjson/ の meetings.ndjson / statements.ndjson を読み込み、
 * 8地方分類 + 年度単位で SQLite シャードを生成する。
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
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { createDb, municipalities } from "./index";
import dotenv from "dotenv";
import { tokenizeBigram } from "./fts/index";

// --- Setup ---

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const dbjsonDir = resolve(root, "packages/db/minutes/dbjson");

// 8地方分類（都道府県 → 地方キー）
const PREFECTURE_TO_REGION: Record<string, string> = {
  北海道: "hokkaido",
  青森県: "tohoku",
  岩手県: "tohoku",
  宮城県: "tohoku",
  秋田県: "tohoku",
  山形県: "tohoku",
  福島県: "tohoku",
  茨城県: "kanto",
  栃木県: "kanto",
  群馬県: "kanto",
  埼玉県: "kanto",
  千葉県: "kanto",
  東京都: "kanto",
  神奈川県: "kanto",
  新潟県: "chubu",
  富山県: "chubu",
  石川県: "chubu",
  福井県: "chubu",
  山梨県: "chubu",
  長野県: "chubu",
  岐阜県: "chubu",
  静岡県: "chubu",
  愛知県: "chubu",
  三重県: "kinki",
  滋賀県: "kinki",
  京都府: "kinki",
  大阪府: "kinki",
  兵庫県: "kinki",
  奈良県: "kinki",
  和歌山県: "kinki",
  鳥取県: "chugoku",
  島根県: "chugoku",
  岡山県: "chugoku",
  広島県: "chugoku",
  山口県: "chugoku",
  徳島県: "shikoku",
  香川県: "shikoku",
  愛媛県: "shikoku",
  高知県: "shikoku",
  福岡県: "kyushu",
  佐賀県: "kyushu",
  長崎県: "kyushu",
  熊本県: "kyushu",
  大分県: "kyushu",
  宮崎県: "kyushu",
  鹿児島県: "kyushu",
  沖縄県: "kyushu",
};

const STATEMENT_BATCH_SIZE = 2000;

// --- Types ---

type MeetingRow = {
  id: string;
  municipalityId: string;
  title: string;
  meetingType: string;
  heldOn: string;
  sourceUrl: string | null;
  externalId: string | null;
  status: string;
  scrapedAt: string | null;
};

type StatementRow = {
  id: string;
  meetingId: string;
  kind: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
  contentHash: string;
  startOffset: number | null;
  endOffset: number | null;
};

type ShardContext = {
  db: Database;
  path: string;
  insertMeeting: ReturnType<Database["prepare"]>;
  insertStatement: ReturnType<Database["prepare"]>;
  insertFts: ReturnType<Database["prepare"]>;
  buffer: StatementRow[];
};

// --- DB helpers ---

function initShardDb(dbPath: string): Database {
  const db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec(`
    CREATE TABLE meetings (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      municipality_id TEXT NOT NULL,
      title TEXT NOT NULL,
      meeting_type TEXT NOT NULL,
      held_on TEXT NOT NULL,
      source_url TEXT,
      external_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      scraped_at INTEGER
    );
    CREATE INDEX meetings_held_on_idx ON meetings (held_on);
    CREATE INDEX meetings_municipality_held_on_idx ON meetings (municipality_id, held_on);
    CREATE TABLE statements (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      meeting_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      speaker_name TEXT,
      speaker_role TEXT,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      start_offset INTEGER,
      end_offset INTEGER
    );
    CREATE INDEX statements_meeting_id_idx ON statements (meeting_id);
    CREATE VIRTUAL TABLE statements_fts USING fts5(
      statement_id UNINDEXED,
      bigrams,
      tokenize = 'unicode61'
    );
  `);
  return db;
}

function createShardContext(dbPath: string): ShardContext {
  const db = initShardDb(dbPath);
  return {
    db,
    path: dbPath,
    insertMeeting: db.prepare(
      "INSERT INTO meetings (id, created_at, updated_at, municipality_id, title, meeting_type, held_on, source_url, external_id, status, scraped_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    insertStatement: db.prepare(
      "INSERT OR IGNORE INTO statements (id, created_at, updated_at, meeting_id, kind, speaker_name, speaker_role, content, content_hash, start_offset, end_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    insertFts: db.prepare(
      "INSERT OR REPLACE INTO statements_fts (statement_id, bigrams) VALUES (?, ?)"
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
        s.endOffset ?? null
      );
      ctx.insertFts.run(s.id, tokenizeBigram(s.content));
    }
  })();

  ctx.buffer.length = 0;
}

// --- Main ---

async function main() {
  const meetingsPath = resolve(dbjsonDir, "meetings.ndjson");
  const statementsPath = resolve(dbjsonDir, "statements.ndjson");

  if (!existsSync(meetingsPath) || !existsSync(statementsPath)) {
    console.error(`[build-sqlite] meetings.ndjson または statements.ndjson が見つかりません: ${dbjsonDir}`);
    console.error("  先に scrape:ndjson を実行してください。");
    process.exit(1);
  }

  const nowMs = Date.now();

  // 1. SQLite (db-minutes) から municipalities を取得
  console.log("[build-sqlite] SQLite から自治体データを取得中...");
  const minutesDb = createDb(process.env.MINUTES_DB_PATH);
  const pgMunicipalities = await minutesDb
    .select({
      id: municipalities.id,
      code: municipalities.code,
      name: municipalities.name,
      prefecture: municipalities.prefecture,
      systemTypeName: municipalities.systemType,
      baseUrl: municipalities.baseUrl,
      enabled: municipalities.enabled,
      population: municipalities.population,
      populationYear: municipalities.populationYear,
    })
    .from(municipalities);

  const municipalityMap = new Map(pgMunicipalities.map((m) => [m.id, m]));
  console.log(`[build-sqlite] ${pgMunicipalities.length} 自治体を取得`);

  // 2. index.sqlite を構築
  const indexDbPath = resolve(dbjsonDir, "index.sqlite");
  if (existsSync(indexDbPath)) unlinkSync(indexDbPath);
  console.log("[build-sqlite] index.sqlite を構築中...");

  const indexDb = new Database(indexDbPath, { create: true });
  indexDb.exec("PRAGMA journal_mode = WAL;");
  indexDb.exec(`
    CREATE TABLE municipalities (
      id TEXT PRIMARY KEY NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      prefecture TEXT NOT NULL,
      system_type TEXT,
      base_url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      population INTEGER,
      population_year INTEGER
    );
    CREATE UNIQUE INDEX municipalities_code_idx ON municipalities (code);
    CREATE INDEX municipalities_prefecture_idx ON municipalities (prefecture);
  `);
  const insertMunicipality = indexDb.prepare(
    "INSERT INTO municipalities (id, created_at, updated_at, code, name, prefecture, system_type, base_url, enabled, population, population_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  indexDb.transaction(() => {
    for (const m of pgMunicipalities) {
      insertMunicipality.run(
        m.id,
        nowMs,
        nowMs,
        m.code,
        m.name,
        m.prefecture,
        m.systemTypeName ?? null,
        m.baseUrl ?? null,
        m.enabled ? 1 : 0,
        m.population ?? null,
        m.populationYear ?? null
      );
    }
  })();
  indexDb.close();
  console.log(`[build-sqlite] index.sqlite 完了 (${pgMunicipalities.length} 自治体)`);

  // 3. meetings.ndjson を読み込み、shardKey でグループ化
  console.log("[build-sqlite] meetings.ndjson を読み込み中...");
  const shardMeetings = new Map<string, MeetingRow[]>();
  const meetingToShard = new Map<string, string>(); // meetingId -> "year/region"
  let totalMeetings = 0;
  let skippedMeetings = 0;

  for await (const line of createInterface({
    input: createReadStream(meetingsPath),
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    const m: MeetingRow = JSON.parse(line);
    const municipality = municipalityMap.get(m.municipalityId);
    if (!municipality) {
      skippedMeetings++;
      continue;
    }
    const year = m.heldOn.slice(0, 4);
    const region = PREFECTURE_TO_REGION[municipality.prefecture] ?? "other";
    const shardKey = `${year}/${region}`;

    let list = shardMeetings.get(shardKey);
    if (!list) {
      list = [];
      shardMeetings.set(shardKey, list);
    }
    list.push(m);
    meetingToShard.set(m.id, shardKey);
    totalMeetings++;
  }

  console.log(
    `[build-sqlite] ${totalMeetings} 会議読み込み完了 (${skippedMeetings} スキップ)`
  );
  console.log(
    `[build-sqlite] シャード: ${[...shardMeetings.keys()].sort().join(", ")}`
  );

  // 4. 各シャード DB を初期化し meetings を INSERT
  const shardContexts = new Map<string, ShardContext>();

  for (const [shardKey, meetings] of shardMeetings) {
    const [year, region] = shardKey.split("/") as [string, string];
    const shardDir = resolve(dbjsonDir, "minutes", year);
    if (!existsSync(shardDir)) mkdirSync(shardDir, { recursive: true });
    const shardPath = resolve(shardDir, `${region}.db`);
    if (existsSync(shardPath)) unlinkSync(shardPath);

    console.log(
      `[build-sqlite] シャード ${shardKey} を初期化中 (${meetings.length} 会議)...`
    );
    const ctx = createShardContext(shardPath);
    shardContexts.set(shardKey, ctx);

    ctx.db.transaction(() => {
      for (const m of meetings) {
        ctx.insertMeeting.run(
          m.id,
          nowMs,
          nowMs,
          m.municipalityId,
          m.title,
          m.meetingType,
          m.heldOn,
          m.sourceUrl ?? null,
          m.externalId ?? null,
          m.status,
          m.scrapedAt ? new Date(m.scrapedAt).getTime() : null
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
    if (!line.trim()) continue;
    const s: StatementRow = JSON.parse(line);
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
    `[build-sqlite] ${totalStatements.toLocaleString()} 発言 (${skippedStatements} スキップ)`
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
    manifest.minutes[year]![region] = [
      { path: relPath, size: statSync(ctx.path).size },
    ];
  }

  writeFileSync(
    resolve(dbjsonDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log("[build-sqlite] 完了!");
  console.log(`  index.sqlite: ${pgMunicipalities.length} 自治体`);
  console.log(`  シャード数: ${shardContexts.size}`);
  console.log(
    `  合計: ${totalMeetings.toLocaleString()} 会議, ${totalStatements.toLocaleString()} 発言`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("[build-sqlite] Fatal error:", err);
  process.exit(1);
});
