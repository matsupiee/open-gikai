/**
 * NDJSON から PostgreSQL DB にインサートするスクリプト（ローカル用）
 *
 * data/minutes/ の meetings.ndjson / statements.ndjson を読み込み、
 * バッチ INSERT でデータベースに投入する。
 *
 * 使い方:
 *   DATABASE_URL="postgresql://..." bun run db:import
 *
 * - _complete が存在するディレクトリをすべて処理する（imported フラグは無視）
 * - imported フラグの記録は行わない
 * - 本番 DB へのインポートには db:import:prd を使用すること
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
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[import] DATABASE_URL が設定されていません");
    process.exit(1);
  }

  const targets = collectImportTargets(dataDir, { skipImported: false });

  if (targets.length === 0) {
    console.log(
      "[import] インポート対象のディレクトリがありません（_complete が存在するディレクトリなし）",
    );
    process.exit(0);
  }

  console.log(`[import] ${targets.length} ディレクトリの NDJSON を検出`);

  const db = createDb(databaseUrl);
  const csvPath = existsSync(municipalitiesCsvPath) ? municipalitiesCsvPath : null;

  const { totalDirs, failedDirs } = await importAll(db, targets, dataDir, {
    municipalitiesCsvPath: csvPath,
    markImported: false,
  });

  console.log("[import] 完了!");
  console.log(`  成功: ${totalDirs} ディレクトリ`);
  if (failedDirs > 0) {
    console.log(`  失敗: ${failedDirs} ディレクトリ`);
  }

  process.exit(failedDirs > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[import] Fatal error:", err);
  process.exit(1);
});
