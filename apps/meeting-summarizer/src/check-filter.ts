/**
 * 議事進行フィルタの精度を検証するスクリプト。
 *
 * PoC の prompt では「発言取消し」「陳情継続審査」「委員選任同意」などを topic 化しないよう指示している。
 * このスクリプトは meetings.topic_digests 内に、議事進行系キーワードを含む topic/digest があるかを洗い出す。
 *
 * 使い方:
 *   bun run src/check-filter.ts -- --municipality 462012
 *   bun run src/check-filter.ts -- --municipality 462012 --limit 50
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "@open-gikai/db";

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

/**
 * 議事進行・手続き事項を示す典型語。
 * prompt.ts の除外リストから抽出。topic 本文にこれらが含まれていれば「フィルタが効いていない候補」として扱う。
 */
const PROCEDURAL_PATTERNS = [
  "発言取消",
  "発言の取消",
  "発言取り消し",
  "陳情継続審査",
  "閉会中継続審査",
  "委員の選任",
  "委員の選挙",
  "委員会委員の選任",
  "会議録署名議員",
  "議長選挙",
  "副議長選挙",
  "会期決定",
  "会期の決定",
  "日程説明",
  "議案の委員会付託",
  "委員会付託",
];

type Args = {
  municipality: string;
  limit: number;
};

type Hit = {
  meetingId: string;
  heldOn: string;
  title: string;
  topic: string;
  relevance: "primary" | "secondary";
  pattern: string;
  digestPreview: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const db = createDb(databaseUrl);

  console.error(`[check-filter] municipality=${args.municipality} patterns=${PROCEDURAL_PATTERNS.length}`);

  const totals = await countSummarizedMeetings(db, args.municipality);
  console.error(`[check-filter] summarized meetings: ${totals.meetings}  total topics: ${totals.topics}`);

  const hits: Hit[] = [];
  for (const pattern of PROCEDURAL_PATTERNS) {
    const rows = await findHits(db, args.municipality, pattern, args.limit);
    for (const r of rows) hits.push({ ...r, pattern });
  }

  if (hits.length === 0) {
    console.error(`[check-filter] ✓ no procedural topics detected`);
    return;
  }

  // パターンごとに集計
  const byPattern = new Map<string, Hit[]>();
  for (const h of hits) {
    const list = byPattern.get(h.pattern) ?? [];
    list.push(h);
    byPattern.set(h.pattern, list);
  }

  console.log(`# 議事進行フィルタ漏れ候補 (municipality=${args.municipality})`);
  console.log(``);
  console.log(`対象 topic 総数: ${totals.topics} / フィルタ漏れ疑い: ${hits.length}`);
  console.log(``);
  for (const [pattern, rows] of byPattern) {
    console.log(`## "${pattern}" にマッチ (${rows.length} 件)`);
    console.log(``);
    for (const r of rows) {
      console.log(
        `- [${r.heldOn}] ${r.title.slice(0, 40)} / relevance=${r.relevance} / topic="${r.topic}"`,
      );
      console.log(`    digest: ${r.digestPreview}`);
    }
    console.log(``);
  }

  console.error(`[check-filter] done. hits=${hits.length}`);
}

async function countSummarizedMeetings(
  db: Db,
  municipalityCode: string,
): Promise<{ meetings: number; topics: number }> {
  const rows = await db.execute<{ meetings: string; topics: string }>(sql`
    SELECT
      COUNT(*)::text AS meetings,
      COALESCE(SUM(jsonb_array_length(topic_digests)), 0)::text AS topics
    FROM meetings
    WHERE municipality_code = ${municipalityCode}
      AND topic_digests IS NOT NULL
  `);
  const r = rows[0];
  return { meetings: Number(r?.meetings ?? 0), topics: Number(r?.topics ?? 0) };
}

async function findHits(
  db: Db,
  municipalityCode: string,
  pattern: string,
  limit: number,
): Promise<Omit<Hit, "pattern">[]> {
  const like = `%${pattern}%`;
  const rows = await db.execute<{
    meeting_id: string;
    held_on: string;
    title: string;
    topic: string;
    relevance: "primary" | "secondary";
    digest_preview: string;
  }>(sql`
    SELECT
      m.id                         AS meeting_id,
      m.held_on::text              AS held_on,
      m.title                      AS title,
      td->>'topic'                 AS topic,
      (td->>'relevance')::text     AS relevance,
      left(td->>'digest', 160)     AS digest_preview
    FROM meetings m
    CROSS JOIN LATERAL jsonb_array_elements(m.topic_digests) td
    WHERE m.municipality_code = ${municipalityCode}
      AND m.topic_digests IS NOT NULL
      AND (td->>'topic' ILIKE ${like} OR td->>'digest' ILIKE ${like})
    ORDER BY m.held_on DESC
    LIMIT ${limit}
  `);
  return rows.map((r) => ({
    meetingId: r.meeting_id,
    heldOn: r.held_on,
    title: r.title,
    topic: r.topic,
    relevance: r.relevance,
    digestPreview: r.digest_preview,
  }));
}

function parseArgs(argv: string[]): Args {
  let municipality: string | undefined;
  let limit = 20;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--municipality") municipality = argv[++i];
    else if (a === "--limit") limit = Number(argv[++i]);
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!municipality) throw new Error("--municipality is required");
  if (!Number.isFinite(limit) || limit < 1) throw new Error("invalid --limit");
  return { municipality, limit };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
