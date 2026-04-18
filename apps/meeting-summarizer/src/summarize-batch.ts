/**
 * 自治体単位でサマリをバッチ生成するスクリプト。
 *
 * 使い方:
 *   bun run summarize:batch -- --municipality 462012
 *   bun run summarize:batch -- --municipality 462012 --concurrency 5
 *   bun run summarize:batch -- --municipality 462012 --limit 10     # 先頭 10 件だけ
 *   bun run summarize:batch -- --municipality 462012 --skip-existing # 既にサマリある会議はスキップ
 *   bun run summarize:batch -- --municipality 462012 --dry-run       # DB に書かず件数だけ確認
 *
 * 基本方針:
 * - 自治体内の meetings を held_on 昇順で処理
 * - 並列度は --concurrency（デフォルト 3）
 * - 1 件失敗しても他を続ける（エラーは stderr に記録）
 * - 各件ごとにコミット（中断しても再開しやすい）
 */

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { and, asc, eq, isNull } from "drizzle-orm";
import { createDb, type Db } from "@open-gikai/db";
import { meetings } from "@open-gikai/db/schema";
import { DEFAULT_MODEL, summarizeMeeting } from "./summarize";

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

type Args = {
  municipality: string;
  concurrency: number;
  limit?: number;
  skipExisting: boolean;
  dryRun: boolean;
  model: string;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");

  const db = createDb(databaseUrl);
  const client = new GoogleGenAI({ apiKey });

  const targets = await loadTargets(db, args);
  console.error(`[batch] target meetings: ${targets.length}`);
  console.error(`[batch] municipality=${args.municipality} concurrency=${args.concurrency} model=${args.model}`);
  if (args.dryRun) {
    console.error(`[batch] dry-run — no LLM calls, no writes`);
    return;
  }

  const stats = {
    done: 0,
    failed: 0,
    totalPromptTokens: 0,
    totalOutputTokens: 0,
    totalThoughtsTokens: 0,
  };
  const startedAt = Date.now();

  // Worker pool による並列処理
  let cursor = 0;
  async function worker(id: number) {
    while (true) {
      const idx = cursor++;
      if (idx >= targets.length) return;
      const m = targets[idx]!;
      const label = `[${idx + 1}/${targets.length}] ${m.heldOn} ${m.title.slice(0, 40)}`;
      try {
        const result = await summarizeMeeting(db, m.id, client, args.model);
        await db
          .update(meetings)
          .set({
            summary: result.summary,
            topicDigests: result.topicDigests,
            summaryGeneratedAt: new Date(),
            summaryModel: args.model,
          })
          .where(eq(meetings.id, m.id));
        stats.done++;
        stats.totalPromptTokens += result.usage.promptTokens;
        stats.totalOutputTokens += result.usage.candidateTokens;
        stats.totalThoughtsTokens += result.usage.thoughtsTokens;
        const topicCount = result.topicDigests.length;
        console.error(
          `worker${id} ✓ ${label}  topics=${topicCount} tokens=${result.usage.promptTokens}/${result.usage.candidateTokens}`,
        );
      } catch (err) {
        stats.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`worker${id} ✗ ${label}  error=${msg}`);
      }
    }
  }

  await Promise.all(Array.from({ length: args.concurrency }, (_, i) => worker(i + 1)));

  const elapsed = (Date.now() - startedAt) / 1000;
  console.error("");
  console.error(`[batch] finished in ${elapsed.toFixed(1)}s`);
  console.error(`  done=${stats.done}  failed=${stats.failed}`);
  console.error(`  tokens: prompt=${stats.totalPromptTokens}  thoughts=${stats.totalThoughtsTokens}  output=${stats.totalOutputTokens}`);

  // Gemini 2.5 Flash 料金（2026-04 時点）: input $0.30/M, output+thoughts $2.50/M
  const inputCost = (stats.totalPromptTokens / 1_000_000) * 0.3;
  const outputCost = ((stats.totalOutputTokens + stats.totalThoughtsTokens) / 1_000_000) * 2.5;
  console.error(`  estimated cost (Flash pricing): $${(inputCost + outputCost).toFixed(4)}`);
}

async function loadTargets(db: Db, args: Args) {
  const where = args.skipExisting
    ? and(eq(meetings.municipalityCode, args.municipality), isNull(meetings.summary))
    : eq(meetings.municipalityCode, args.municipality);
  const rows = await db.query.meetings.findMany({
    where,
    orderBy: [asc(meetings.heldOn), asc(meetings.id)],
    columns: { id: true, title: true, heldOn: true },
    limit: args.limit,
  });
  return rows;
}

function parseArgs(argv: string[]): Args {
  let municipality: string | undefined;
  let concurrency = 3;
  let limit: number | undefined;
  let skipExisting = false;
  let dryRun = false;
  let model = DEFAULT_MODEL;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--municipality") municipality = argv[++i];
    else if (a === "--concurrency") concurrency = Number(argv[++i]);
    else if (a === "--limit") limit = Number(argv[++i]);
    else if (a === "--skip-existing") skipExisting = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--model") model = argv[++i]!;
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!municipality) throw new Error("--municipality is required");
  if (!Number.isFinite(concurrency) || concurrency < 1) throw new Error("invalid --concurrency");
  return { municipality, concurrency, limit, skipExisting, dryRun, model };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
