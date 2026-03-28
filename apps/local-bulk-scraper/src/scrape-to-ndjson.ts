/**
 * ローカル一括スクレイピング → NDJSON 出力スクリプト
 *
 * 全 enabled 自治体をスクレイピングし、meetings / statements
 * の NDJSON ファイルを出力する。
 *
 * 使い方:
 *   bun run scrape:ndjson
 *   bun run scrape:ndjson -- --year 2025
 *   bun run scrape:ndjson -- --system-type dbsearch
 *   bun run scrape:ndjson -- --system-type custom
 *   bun run scrape:ndjson -- --year 2025 --system-type discussnet
 *   bun run scrape:ndjson -- --system-type kensakusystem --meeting-limit 2
 *   bun run scrape:ndjson -- --target 011002,012025
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  SharedSystemAdapterKey,
  detectAdapterKey,
  getAdapter,
  initAdapterRegistry,
} from "./utils/scrapers";
import {
  CUSTOM_SYSTEM_TYPE,
  parseYear,
  parseMeetingLimit,
  parseTarget,
  parseSystemType,
} from "./utils/cli-args";
import { runGroupedByHost } from "./utils/concurrency";
import {
  runMunicipalityNdjsonScrape,
  type NdjsonScrapeAccumulator,
} from "./utils/run-municipality-ndjson-scrape";
import { createScrapeRunLogger } from "./utils/scrape-run-logger";
import { parseMunicipalitiesCsv } from "./utils/parse-municipalities-csv";

// --- Setup ---

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const municipalitiesCsvPath = resolve(root, "data/municipalities.csv");

async function main() {
  await initAdapterRegistry();
  const targetYear = parseYear();
  const targetSystemType = parseSystemType();
  const targetCodes = parseTarget();
  const meetingLimit = parseMeetingLimit();

  const { log, logDir, ndjsonDir, endLog } = createScrapeRunLogger(import.meta.url, root);

  if (targetYear) {
    log.info(`[scrape-to-ndjson] ${targetYear}年を対象にスクレイピングします`);
  }
  if (targetSystemType) {
    log.info(`[scrape-to-ndjson] システムタイプ: ${targetSystemType} のみ対象`);
  }
  if (meetingLimit) {
    log.info(`[scrape-to-ndjson] meeting 数制限: 各自治体 ${meetingLimit} 件まで`);
  }
  if (targetCodes) {
    log.info(`[scrape-to-ndjson] 対象自治体コード: ${targetCodes.join(", ")}`);
  }
  log.info("[scrape-to-ndjson] Starting...");

  // municipalities.csv（団体コード = meetings.ndjson の municipalityCode）
  if (!existsSync(municipalitiesCsvPath)) {
    log.error(`[scrape-to-ndjson] CSV が見つかりません: ${municipalitiesCsvPath}`);
    await endLog();
    process.exit(1);
  }

  let csvRows = parseMunicipalitiesCsv(municipalitiesCsvPath).filter((r) => r.baseUrl);
  if (targetCodes) {
    const set = new Set(targetCodes);
    csvRows = csvRows.filter((r) => set.has(r.code));
  }

  const sharedSystemTypes = new Set<string>(Object.values(SharedSystemAdapterKey));

  let enabledTargets = csvRows.filter((t) => getAdapter(detectAdapterKey(t.baseUrl, t.code)));
  if (targetSystemType === CUSTOM_SYSTEM_TYPE) {
    enabledTargets = enabledTargets.filter(
      (t) => !sharedSystemTypes.has(detectAdapterKey(t.baseUrl, t.code)),
    );
  } else if (targetSystemType) {
    enabledTargets = enabledTargets.filter(
      (t) => detectAdapterKey(t.baseUrl, t.code) === targetSystemType,
    );
  }

  log.info(`[scrape-to-ndjson] ${enabledTargets.length} 自治体を処理します`);

  const currentYear = new Date().getFullYear();
  const years = targetYear ? [targetYear] : Array.from({ length: 5 }, (_, i) => currentYear - i);

  const acc: NdjsonScrapeAccumulator = {
    totalMeetings: 0,
    totalStatements: 0,
    totalSkipped: 0,
    failedMunicipalities: [],
  };

  let completedCount = 0;
  const totalCount = enabledTargets.length;

  const tasks = enabledTargets.map((target) => async () => {
    await runMunicipalityNdjsonScrape({
      target,
      years,
      meetingLimit,
      ndjsonDir,
      log,
      acc,
    });
    completedCount++;
    if (completedCount % 100 === 0 || completedCount === totalCount) {
      log.info(`[scrape-to-ndjson] 進捗: ${completedCount} / ${totalCount} 自治体完了`);
    }
  });

  await runGroupedByHost(enabledTargets, tasks);

  log.info("[scrape-to-ndjson] 完了!");
  log.info(` NDJSON 出力先: ${ndjsonDir}/{year}/{municipalityCode}/`);
  log.info(` ログ出力先: ${logDir}`);
  log.info(` meetings: ${acc.totalMeetings} 件`);
  log.info(` statements: ${acc.totalStatements} 件`);
  if (acc.totalSkipped > 0) {
    log.info(`  スキップ（既存データ）: ${acc.totalSkipped} 件`);
  }

  if (acc.failedMunicipalities.length > 0) {
    log.info("");
    log.info(`[scrape-to-ndjson] 失敗した自治体: ${acc.failedMunicipalities.length} 件`);
    const byType = new Map<string, number>();
    for (const f of acc.failedMunicipalities) {
      byType.set(f.systemType, (byType.get(f.systemType) ?? 0) + 1);
    }
    for (const [type, count] of byType) {
      log.info(`  ${type}: ${count} 件`);
    }
    log.info("");
    for (const f of acc.failedMunicipalities) {
      log.info(` [FAIL] ${f.prefecture} ${f.name} (${f.systemType}): ${f.reason}`);
    }
  }

  await endLog();

  process.exit(0);
}

main().catch((err) => {
  console.error("[scrape-to-ndjson] Fatal error:", err);
  process.exit(1);
});
