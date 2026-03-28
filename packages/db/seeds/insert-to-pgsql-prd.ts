/**
 * NDJSON から PostgreSQL DB にインサートするスクリプト（本番用）
 *
 * data/minutes/ の meetings.ndjson / statements.ndjson を読み込み、
 * バッチ INSERT でデータベースに投入する。
 *
 * 使い方:
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:import:prd
 *   DATABASE_URL_FOR_PRD_IMPORT="postgresql://..." bun run db:import:prd 011002 012025  # 特定の自治体のみ
 *
 * - _complete が存在し、かつ imported フラグが立っていないディレクトリのみ処理する
 * - 各ディレクトリの処理成功後に _complete へ imported フラグを記録する
 * - 途中でエラーが起きても、完了済みディレクトリのフラグは保持される
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { createDb } from "../src/index";
import { collectImportTargets } from "./utils/collect-import-targets";
import { importAll } from "./utils/import-runner";

const seedsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(seedsDir, "../../..");

dotenv.config({ path: resolve(root, ".env.local"), override: true });

const dataDir = resolve(root, "data/minutes");

const municipalitiesCsvPath = resolve(root, "data", "municipalities.csv");

async function main() {
  const databaseUrl = process.env.DATABASE_URL_FOR_PRD_IMPORT;
  if (!databaseUrl) {
    console.error("[import:prd] DATABASE_URL_FOR_PRD_IMPORT が設定されていません");
    process.exit(1);
  }

  const municipalityCodes = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));

  if (municipalityCodes.length > 0) {
    console.log(`[import:prd] 対象自治体コード: ${municipalityCodes.join(", ")}`);
  }

  const targets = collectImportTargets(dataDir, { skipImported: true, municipalityCodes });

  if (targets.length === 0) {
    console.log(
      "[import:prd] インポート対象のディレクトリがありません（_complete 未完了 or すべてインポート済み）",
    );
    process.exit(0);
  }

  console.log(`[import:prd] ${targets.length} ディレクトリの NDJSON を検出（未インポート）`);

  const db = createDb(databaseUrl);
  const csvPath = existsSync(municipalitiesCsvPath) ? municipalitiesCsvPath : null;

  const { totalDirs, failedDirs } = await importAll(db, targets, dataDir, {
    municipalitiesCsvPath: csvPath,
    markImported: true,
  });

  console.log("[import:prd] 完了!");
  console.log(`  成功: ${totalDirs} ディレクトリ`);
  if (failedDirs > 0) {
    console.log(`  失敗: ${failedDirs} ディレクトリ`);
  }

  process.exit(failedDirs > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[import:prd] Fatal error:", err);
  process.exit(1);
});
