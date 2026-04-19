/**
 * 1 会議分だけサマリを生成して結果を標準出力に表示する PoC スクリプト。
 *
 * 使い方:
 *   # meeting id を直接指定
 *   bun run summarize:one -- --meeting-id <id>
 *
 *   # 鹿児島市の直近 plenary を自動選択
 *   bun run summarize:one -- --kagoshima-sample
 *
 *   # サマリを NDJSON に書かず stdout 出力だけする場合
 *   bun run summarize:one -- --kagoshima-sample --dry-run
 *
 *   # モデルを切り替え
 *   bun run summarize:one -- --kagoshima-sample --model gemini-2.5-pro
 *
 * サマリ結果は data/minutes/{year}/{municipalityCode}/summaries.ndjson に追記される。
 * 本番 DB への反映は packages/db の `db:import:summaries:prd` スクリプトで行う。
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { and, desc, eq } from "drizzle-orm";
import { createDb } from "@open-gikai/db";
import { meetings } from "@open-gikai/db/schema";
import { DEFAULT_MODEL, summarizeMeeting } from "./summarize";
import { appendSummaryRow } from "./write-summary-ndjson";

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const dataDir = resolve(root, "data/minutes");

const KAGOSHIMA = "462012";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");

  const db = createDb(databaseUrl);
  const client = new GoogleGenAI({ apiKey });

  const meetingId = args.meetingId ?? (await pickKagoshimaSample(db));
  console.error(`[meeting-summarizer] summarizing meeting id=${meetingId}`);

  const meeting = await db.query.meetings.findFirst({
    where: eq(meetings.id, meetingId),
  });
  if (!meeting) throw new Error(`meeting not found: ${meetingId}`);
  console.error(`  title: ${meeting.title}`);
  console.error(`  heldOn: ${meeting.heldOn}  type: ${meeting.meetingType}`);

  const model = args.model ?? DEFAULT_MODEL;
  console.error(`  model: ${model}`);

  const startedAt = Date.now();
  const result = await summarizeMeeting(db, meetingId, client, dataDir, model);
  const elapsed = Date.now() - startedAt;

  console.error("");
  console.error(`[meeting-summarizer] done in ${(elapsed / 1000).toFixed(1)}s`);
  console.error(`  prompt_tokens: ${result.usage.promptTokens}`);
  console.error(`  thoughts_tokens: ${result.usage.thoughtsTokens}`);
  console.error(`  candidate_tokens: ${result.usage.candidateTokens}`);
  console.error(`  total_tokens: ${result.usage.totalTokens}`);

  console.log(
    JSON.stringify({ summary: result.summary, topic_digests: result.topicDigests }, null, 2),
  );

  if (args.dryRun) {
    console.error(`[meeting-summarizer] dry-run — not writing NDJSON`);
    return;
  }

  await appendSummaryRow(dataDir, {
    meetingId,
    municipalityCode: meeting.municipalityCode,
    heldOn: meeting.heldOn,
    summary: result.summary,
    topicDigests: result.topicDigests,
    summaryModel: model,
    summaryGeneratedAt: new Date().toISOString(),
  });
  console.error(
    `[meeting-summarizer] wrote summary to data/minutes/${meeting.heldOn.slice(0, 4)}/${meeting.municipalityCode}/summaries.ndjson`,
  );
}

async function pickKagoshimaSample(db: ReturnType<typeof createDb>): Promise<string> {
  const m = await db.query.meetings.findFirst({
    where: and(eq(meetings.municipalityCode, KAGOSHIMA), eq(meetings.meetingType, "plenary")),
    orderBy: [desc(meetings.heldOn)],
  });
  if (!m) throw new Error("no Kagoshima plenary found");
  return m.id;
}

function parseArgs(argv: string[]): { meetingId?: string; dryRun: boolean; model?: string } {
  let meetingId: string | undefined;
  let dryRun = false;
  let model: string | undefined;
  let useSample = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--meeting-id") meetingId = argv[++i];
    else if (a === "--kagoshima-sample") useSample = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--model") model = argv[++i];
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!meetingId && !useSample) {
    throw new Error("pass --meeting-id <id> or --kagoshima-sample");
  }
  return { meetingId, dryRun, model };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
