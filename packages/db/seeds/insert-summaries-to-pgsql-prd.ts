/**
 * NDJSON サマリ結果を PostgreSQL DB に反映するスクリプト（本番用）
 *
 * data/minutes/{year}/{municipalityCode}/summaries.ndjson を読み込み、
 * meetings テーブルの summary / topicDigests / summaryGeneratedAt / summaryModel を UPDATE する。
 *
 * 使い方:
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:import:summaries:prd
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:import:summaries:prd 462012  # 特定の自治体のみ
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:import:summaries:prd --force  # フラグを無視して再 import
 *
 * - _summaries_complete に summariesImported フラグが立っていないディレクトリのみ処理する
 * - 各ディレクトリの処理成功後に _summaries_complete を作成する
 * - --force でフラグを無視して全ディレクトリ再処理（NDJSON が再生成された場合）
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
  const databaseUrl = process.env.DATABASE_URL_FOR_PRD_IMPORT;
  if (!databaseUrl) {
    console.error("[import:summaries:prd] DATABASE_URL_FOR_PRD_IMPORT が設定されていません");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const municipalityCodes = args.filter((arg) => !arg.startsWith("-"));

  if (municipalityCodes.length > 0) {
    console.log(`[import:summaries:prd] 対象自治体コード: ${municipalityCodes.join(", ")}`);
  }
  if (force) {
    console.log(`[import:summaries:prd] --force: summariesImported フラグを無視`);
  }

  const targets = collectSummaryImportTargets(dataDir, {
    skipImported: !force,
    municipalityCodes,
  });

  if (targets.length === 0) {
    console.log(
      "[import:summaries:prd] インポート対象なし（summaries.ndjson 未存在 or すべてインポート済み）",
    );
    process.exit(0);
  }

  console.log(
    `[import:summaries:prd] ${targets.length} ディレクトリの summaries.ndjson を検出（未インポート）`,
  );

  const db = createDb(databaseUrl);
  const { totalDirs, failedDirs, totalUpdated } = await importAllSummaries(db, targets, dataDir, {
    markImported: true,
  });

  console.log("[import:summaries:prd] 完了!");
  console.log(`  成功: ${totalDirs} ディレクトリ  UPDATE 件数: ${totalUpdated}`);
  if (failedDirs > 0) {
    console.log(`  失敗: ${failedDirs} ディレクトリ`);
  }

  process.exit(failedDirs > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[import:summaries:prd] Fatal error:", err);
  process.exit(1);
});
