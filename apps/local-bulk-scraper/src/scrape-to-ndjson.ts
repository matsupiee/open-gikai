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
 *   bun run scrape:ndjson -- --year 2025 --system-type discussnet
 *   bun run scrape:ndjson -- --system-type kensakusystem --meeting-limit 2
 *   bun run scrape:ndjson -- --target 011002,012025
 */

import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { municipalityRowsFromCsv } from "@open-gikai/db-minutes/seeds/parse-data/municipalities";
import { createId } from "@paralleldrive/cuid2";
import dotenv from "dotenv";
import type { MeetingData } from "@open-gikai/scrapers";
import {
  detectAdapterKey,
  getAdapter,
  initAdapterRegistry,
} from "@open-gikai/scrapers";
import { getDetailConcurrency, runGroupedByHost } from "./utils/concurrency";
import { parseYear, parseMeetingLimit, parseTarget, parseSystemType } from "./utils/cli-args";
import { scrapeOneYear } from "./utils/scrape-one-year";

// --- Setup ---

const root = resolve(fileURLToPath(import.meta.url), "../../../../");
dotenv.config({ path: resolve(root, ".env.local"), override: true });

const municipalitiesCsvPath = resolve(
  root,
  "packages/db/minutes/src/seeds/data/municipalities.csv",
);

async function main() {
  await initAdapterRegistry();
  const targetYear = parseYear();
  const targetSystemType = parseSystemType();
  const targetCodes = parseTarget();
  const meetingLimit = parseMeetingLimit();

  // 1. 出力ディレクトリの準備（ログ記録のため最初に作成）
  const today = new Date().toISOString().slice(0, 10);
  // ログは apps/local-bulk-scraper/output/{today}/ に出力
  const logDir = resolve(fileURLToPath(import.meta.url), "../../output", today);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  // NDJSON は packages/db/minutes/dbjson/{year}/{municipalityCode}/ に出力
  const ndjsonDir = resolve(root, "packages/db/minutes/dbjson");
  if (!existsSync(ndjsonDir)) {
    mkdirSync(ndjsonDir, { recursive: true });
  }

  const runTimestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logStream = createWriteStream(resolve(logDir, `scrape-${runTimestamp}.log`));

  const log = (level: "INFO" | "WARN" | "ERROR", ...args: unknown[]) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${args.map(String).join(" ")}`;
    if (level === "ERROR") {
      console.error(line);
    } else if (level === "WARN") {
      console.warn(line);
    } else {
      console.log(line);
    }
    logStream.write(line + "\n");
  };

  if (targetYear) {
    log("INFO", `[scrape-to-ndjson] ${targetYear}年を対象にスクレイピングします`);
  }
  if (targetSystemType) {
    log("INFO", `[scrape-to-ndjson] システムタイプ: ${targetSystemType} のみ対象`);
  }
  if (meetingLimit) {
    log("INFO", `[scrape-to-ndjson] meeting 数制限: 各自治体 ${meetingLimit} 件まで`);
  }
  if (targetCodes) {
    log("INFO", `[scrape-to-ndjson] 対象自治体コード: ${targetCodes.join(", ")}`);
  }
  log("INFO", "[scrape-to-ndjson] Starting...");

  // 2. municipalities.csv（団体コード = meetings.ndjson の municipalityCode）
  if (!existsSync(municipalitiesCsvPath)) {
    log("ERROR", `[scrape-to-ndjson] CSV が見つかりません: ${municipalitiesCsvPath}`);
    await new Promise<void>((r) => logStream.end(r));
    process.exit(1);
  }

  let csvRows = municipalityRowsFromCsv(municipalitiesCsvPath).filter((r) => r.enabled && r.baseUrl);
  if (targetCodes) {
    const set = new Set(targetCodes);
    csvRows = csvRows.filter((r) => set.has(r.code));
  }

  let enabledTargets = csvRows.filter((t) => getAdapter(detectAdapterKey(t.baseUrl, t.code)));
  if (targetSystemType) {
    enabledTargets = enabledTargets.filter((t) => detectAdapterKey(t.baseUrl, t.code) === targetSystemType);
  }

  log("INFO", `[scrape-to-ndjson] ${enabledTargets.length} 自治体を処理します`);

  const currentYear = new Date().getFullYear();
  const years = targetYear ? [targetYear] : Array.from({ length: 5 }, (_, i) => currentYear - i);

  let totalMeetings = 0;
  let totalStatements = 0;
  let totalSkipped = 0;
  const failedMunicipalities: {
    name: string;
    prefecture: string;
    systemType: string;
    reason: string;
  }[] = [];

  // 3. 自治体を並列スクレイピング（年度ごとにディレクトリ分割）
  const tasks = enabledTargets.map((target) => async () => {
    if (!target.baseUrl) throw new Error(); // この分岐に入ることはないが型安全のため書く

    const adapterKey = detectAdapterKey(target.baseUrl, target.code);
    const adapter = getAdapter(adapterKey);
    if (!adapter) throw new Error(); // この分岐に入ることはないが型安全のため書く

    log("INFO", `[scrape-to-ndjson] ${target.prefecture} ${target.name} (${adapterKey})`);

    let municipalityMeetingCount = 0;

    for (const year of years) {
      if (meetingLimit && municipalityMeetingCount >= meetingLimit) break;

      // 既存データがあればスキップ（再開性）
      const yearDir = resolve(ndjsonDir, String(year), target.code);
      const meetingsPath = resolve(yearDir, "meetings.ndjson");
      if (existsSync(meetingsPath)) {
        log("INFO", `${target.name}: ${year}年 → スキップ（既存データあり）`);
        totalSkipped++;
        continue;
      }

      let meetingDataList: MeetingData[];
      try {
        const remaining = meetingLimit ? meetingLimit - municipalityMeetingCount : undefined;
        meetingDataList = await scrapeOneYear(
          adapter,
          target.code,
          target.name,
          target.baseUrl,
          year,
          remaining,
          getDetailConcurrency(adapterKey),
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        log("ERROR", `${target.name}: ${year}年 スクレイピング失敗: ${reason}`);
        failedMunicipalities.push({
          name: target.name,
          prefecture: target.prefecture,
          systemType: adapterKey,
          reason: `${year}年: ${reason}`,
        });
        continue;
      }

      if (meetingDataList.length === 0) {
        log("INFO", `${target.name}: ${year}年 → 0 件`);
        continue;
      }

      // ディレクトリを作成して NDJSON を書き出す
      mkdirSync(yearDir, { recursive: true });
      const meetingsStream = createWriteStream(meetingsPath);
      const statementsStream = createWriteStream(resolve(yearDir, "statements.ndjson"));

      for (const meetingData of meetingDataList) {
        const meetingId = createId();
        const now = new Date().toISOString();

        meetingsStream.write(
          JSON.stringify({
            id: meetingId,
            municipalityCode: meetingData.municipalityCode,
            title: meetingData.title,
            meetingType: meetingData.meetingType,
            heldOn: meetingData.heldOn,
            sourceUrl: meetingData.sourceUrl,
            externalId: meetingData.externalId,
            status: "processed",
            scrapedAt: now,
          }) + "\n",
        );
        totalMeetings++;
        municipalityMeetingCount++;

        for (const s of meetingData.statements) {
          const stmtId = createId();
          statementsStream.write(
            JSON.stringify({
              id: stmtId,
              meetingId,
              kind: s.kind,
              speakerName: s.speakerName,
              speakerRole: s.speakerRole,
              content: s.content,
              contentHash: s.contentHash,
              startOffset: s.startOffset,
              endOffset: s.endOffset,
            }) + "\n",
          );
          totalStatements++;
        }
      }

      await Promise.all([
        new Promise<void>((r) => meetingsStream.end(r)),
        new Promise<void>((r) => statementsStream.end(r)),
      ]);

      log("INFO", `${target.name}: ${year}年 → ${meetingDataList.length} 件`);
    }
  });

  await runGroupedByHost(enabledTargets, tasks);

  log("INFO", "[scrape-to-ndjson] 完了!");
  log("INFO", `  NDJSON 出力先: ${ndjsonDir}/{year}/{municipalityCode}/`);
  log("INFO", `  ログ出力先: ${logDir}`);
  log("INFO", `  meetings: ${totalMeetings} 件`);
  log("INFO", `  statements: ${totalStatements} 件`);
  if (totalSkipped > 0) {
    log("INFO", `  スキップ（既存データ）: ${totalSkipped} 件`);
  }

  if (failedMunicipalities.length > 0) {
    log("INFO", "");
    log("INFO", `[scrape-to-ndjson] 失敗した自治体: ${failedMunicipalities.length} 件`);
    const byType = new Map<string, number>();
    for (const f of failedMunicipalities) {
      byType.set(f.systemType, (byType.get(f.systemType) ?? 0) + 1);
    }
    for (const [type, count] of byType) {
      log("INFO", `  ${type}: ${count} 件`);
    }
    log("INFO", "");
    for (const f of failedMunicipalities) {
      log("INFO", `  [FAIL] ${f.prefecture} ${f.name} (${f.systemType}): ${f.reason}`);
    }
  }

  await new Promise<void>((resolve) => logStream.end(resolve));

  process.exit(0);
}

main().catch((err) => {
  console.error("[scrape-to-ndjson] Fatal error:", err);
  process.exit(1);
});
