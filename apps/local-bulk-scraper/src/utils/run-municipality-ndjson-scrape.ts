import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { MeetingData } from "@open-gikai/scrapers";
import { detectAdapterKey, getAdapter } from "@open-gikai/scrapers";
import { checkYearNdjsonIntegrity } from "./ndjson-year-integrity";
import type { ScrapeLogger } from "./scrape-run-logger";
import { scrapeOneYear } from "./scrape-one-year";
import type { MunicipalityCsvRow } from "./parse-municipalities-csv";

export interface FailedMunicipalityEntry {
  name: string;
  prefecture: string;
  systemType: string;
  reason: string;
}

export interface NdjsonScrapeAccumulator {
  totalMeetings: number;
  totalStatements: number;
  totalSkipped: number;
  failedMunicipalities: FailedMunicipalityEntry[];
}

/**
 * 1 自治体について、年度ごとにスクレイプして NDJSON を書き出す。
 * 再開時は meetings / statements が揃い、全会議に対応する発言があるときのみスキップ。
 */
export async function runMunicipalityNdjsonScrape(params: {
  target: MunicipalityCsvRow;
  years: number[];
  meetingLimit: number | undefined;
  ndjsonDir: string;
  log: ScrapeLogger;
  acc: NdjsonScrapeAccumulator;
}): Promise<void> {
  const { target, years, meetingLimit, ndjsonDir, log, acc } = params;
  if (!target.baseUrl) throw new Error();
  const { baseUrl } = target;

  const adapterKey = detectAdapterKey(baseUrl, target.code);
  const adapter = getAdapter(adapterKey);
  if (!adapter) throw new Error();

  log.info(`[scrape-to-ndjson] ${target.prefecture} ${target.name} (${adapterKey})`);

  let municipalityMeetingCount = 0;

  for (const year of years) {
    if (meetingLimit && municipalityMeetingCount >= meetingLimit) break;

    const yearDir = resolve(ndjsonDir, String(year), target.code);
    const meetingsPath = resolve(yearDir, "meetings.ndjson");
    if (existsSync(meetingsPath)) {
      const integrity = await checkYearNdjsonIntegrity(yearDir);
      if (integrity.complete) {
        log.info(`${target.name}: ${year}年 → スキップ（既存データあり・発言整合OK）`);
        acc.totalSkipped++;
        continue;
      }
      log.warn(
        `${target.name}: ${year}年 → 既存 NDJSON が不完全のため再スクレイプします（${integrity.reason}）`,
      );
      rmSync(yearDir, { recursive: true, force: true });
    }

    let meetingDataList: MeetingData[];
    let truncated: boolean;
    try {
      const remaining = meetingLimit ? meetingLimit - municipalityMeetingCount : undefined;
      const result = await scrapeOneYear(
        adapter,
        target.code,
        target.name,
        baseUrl,
        year,
        remaining,
      );
      meetingDataList = result.meetings;
      truncated = result.truncated;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.error(`${target.name}: ${year}年 スクレイピング失敗: ${reason}`);
      acc.failedMunicipalities.push({
        name: target.name,
        prefecture: target.prefecture,
        systemType: adapterKey,
        reason: `${year}年: ${reason}`,
      });
      continue;
    }

    if (meetingDataList.length === 0) {
      log.info(`${target.name}: ${year}年 → 0 件`);
      continue;
    }

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
      acc.totalMeetings++;
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
        acc.totalStatements++;
      }
    }

    await Promise.all([
      new Promise<void>((r) => meetingsStream.end(r)),
      new Promise<void>((r) => statementsStream.end(r)),
    ]);

    if (truncated) {
      log.info(
        `${target.name}: ${year}年 → ${meetingDataList.length} 件（meeting-limit により部分取得・_complete スキップ）`,
      );
    } else {
      writeFileSync(
        resolve(yearDir, "_complete"),
        JSON.stringify({
          completedAt: new Date().toISOString(),
          meetings: meetingDataList.length,
          statements: meetingDataList.reduce((sum, m) => sum + m.statements.length, 0),
        }) + "\n",
      );
      log.info(`${target.name}: ${year}年 → ${meetingDataList.length} 件`);
    }
  }
}
