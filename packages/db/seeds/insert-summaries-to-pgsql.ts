/**
 * NDJSON サマリ結果を PostgreSQL DB に反映するスクリプト（ローカル用）
 *
 * data/minutes/{year}/{municipalityCode}/summaries.ndjson を読み込み、
 * meetings テーブルの summary / topicDigests / summaryGeneratedAt / summaryModel を UPDATE する。
 *
 * 使い方:
 *   DATABASE_URL="postgresql://..." bun run db:import:summaries
 *   DATABASE_URL="postgresql://..." bun run db:import:summaries 462012  # 特定の自治体のみ
 *
 * - summaries.ndjson が存在するすべてのディレクトリを処理する（_summaries_complete は無視）
 * - フラグの記録は行わない
 * - 本番 DB へのインポートには db:import:summaries:prd を使用すること
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createDb } from "../src/index";
import { collectSummaryImportTargets } from "./utils/collect-summary-import-targets";
import { importAllSummaries } from "./utils/summaries-import-runner";

const seedsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(seedsDir, "../../..");

dotenv.config({ path: resolve(root, ".env.local"), override: true });

const dataDir = resolve(root, "data/minutes");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[import:summaries] DATABASE_URL が設定されていません");
    process.exit(1);
  }

  const municipalityCodes = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

  if (municipalityCodes.length > 0) {
    console.log(`[import:summaries] 対象自治体コード: ${municipalityCodes.join(", ")}`);
  }

  const targets = collectSummaryImportTargets(dataDir, {
    skipImported: false,
    municipalityCodes,
  });

  if (targets.length === 0) {
    console.log("[import:summaries] summaries.ndjson が見つかりません");
    process.exit(0);
  }

  console.log(`[import:summaries] ${targets.length} ディレクトリの summaries.ndjson を検出`);

  const db = createDb(databaseUrl);
  const { totalDirs, failedDirs, totalUpdated } = await importAllSummaries(db, targets, dataDir, {
    markImported: false,
  });

  console.log("[import:summaries] 完了!");
  console.log(`  成功: ${totalDirs} ディレクトリ  UPDATE 件数: ${totalUpdated}`);
  if (failedDirs > 0) {
    console.log(`  失敗: ${failedDirs} ディレクトリ`);
  }

  process.exit(failedDirs > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[import:summaries] Fatal error:", err);
  process.exit(1);
});
