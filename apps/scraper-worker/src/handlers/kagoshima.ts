import { eq } from "drizzle-orm";
import { scraper_jobs } from "@open-gikai/db/schema";
import type { Db } from "../db";
import { addJobStats, createJobLogger, updateJobStatus } from "../job-logger";
import type { ScraperQueueMessage } from "../types";
import { saveMeetings } from "./save-meetings";

const API_BASE = "https://ssp.kaigiroku.net/dnp/search";
const TENANT_ID = 539;
const MUNICIPALITY = "鹿児島市";
const PREFECTURE = "鹿児島県";
const DELAY_MS = 1500;

interface ScheduleEntry {
  schedule_id: number;
  name: string;
  page_no: number;
}

interface GetScheduleResponse {
  council_schedules: ScheduleEntry[];
}

interface MinuteEntry {
  minute_id: number;
  title: string;
  page_no: number;
  body: string;
}

interface GetMinuteResponse {
  tenant_minutes: MinuteEntry[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function extractText(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\r\n/g, "\n").trim();
}

function normalizeJa(str: string): string {
  return str
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[　]/g, " ");
}

function parseDateFromSchedule(scheduleName: string, councilName: string): string | null {
  const normCouncil = normalizeJa(councilName);
  const normSchedule = normalizeJa(scheduleName);

  const yearMatch = normCouncil.match(/令和\s*(\d+)年/);
  if (!yearMatch?.[1]) return null;
  const reiwaYear = parseInt(yearMatch[1], 10);
  const year = 2018 + reiwaYear;

  const mdMatch = normSchedule.match(/(\d{1,2})月(\d{1,2})日/);
  if (!mdMatch?.[1] || !mdMatch[2]) return null;
  const month = mdMatch[1].padStart(2, "0");
  const day = mdMatch[2].padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function classifyMeetingType(typeGroupNames: string[]): string {
  const names = typeGroupNames.join("/");
  if (names.includes("委員会")) return "committee";
  if (names.includes("臨時会")) return "extraordinary";
  return "plenary";
}

type KagoshimaCouncilMsg = Extract<ScraperQueueMessage, { type: "kagoshima-council" }>;

export async function handleKagoshimaCouncil(
  db: Db,
  _queue: Queue<ScraperQueueMessage>,
  msg: KagoshimaCouncilMsg
): Promise<void> {
  const { jobId, councilId, councilName, typeGroupNames, remainingCouncils } = msg;
  const logger = createJobLogger(db, jobId);

  // キャンセル確認
  const rows = await db
    .select({ status: scraper_jobs.status })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);
  if (rows[0]?.status === "cancelled") {
    await logger("info", "ジョブがキャンセルされました");
    return;
  }

  await logger("info", `鹿児島: 処理中 — ${councilName} (id=${councilId})`);

  await delay(DELAY_MS);
  const schedResp = await apiPost<GetScheduleResponse>("minutes/get_schedule", {
    tenant_id: TENANT_ID,
    council_id: councilId,
  });

  if (!schedResp || !schedResp.council_schedules.length) {
    await logger("warn", `鹿児島: 議会 ${councilId} のスケジュールが見つかりません`);
    await finishCouncil(db, jobId, remainingCouncils, logger, 0, 0);
    return;
  }

  const meetingType = classifyMeetingType(typeGroupNames);
  const records = [];

  for (const sched of schedResp.council_schedules) {
    await delay(DELAY_MS);
    const minuteResp = await apiPost<GetMinuteResponse>("minutes/get_minute", {
      tenant_id: TENANT_ID,
      council_id: councilId,
      schedule_id: sched.schedule_id,
      minute_id: 0,
    });

    if (!minuteResp || !minuteResp.tenant_minutes.length) {
      await logger("warn", `鹿児島: スケジュール ${sched.schedule_id} の議事録が見つかりません`);
      continue;
    }

    const combinedText = minuteResp.tenant_minutes
      .map((m) => extractText(m.body))
      .filter(Boolean)
      .join("\n\n---\n\n");

    const heldOn = parseDateFromSchedule(sched.name, councilName);
    if (!heldOn) {
      await logger("warn", `鹿児島: 日付を解析できません — "${sched.name}" / "${councilName}"`);
      continue;
    }

    records.push({
      title: `${councilName}　${sched.name}`,
      meetingType,
      heldOn,
      sourceUrl: `https://ssp.kaigiroku.net/tenant/kagoshima/MinuteView.html?council_id=${councilId}&schedule_id=${sched.schedule_id}&minute_id=0`,
      assemblyLevel: "municipal" as const,
      prefecture: PREFECTURE,
      municipality: MUNICIPALITY,
      externalId: `kagoshima_${councilId}_${sched.schedule_id}`,
      rawText: combinedText,
    });
  }

  const { inserted, skipped } = await saveMeetings(db, records);
  await logger("info", `鹿児島: ${councilName} 完了 (inserted=${inserted}, skipped=${skipped})`);
  await finishCouncil(db, jobId, remainingCouncils, logger, inserted, skipped);
}

async function finishCouncil(
  db: Db,
  jobId: string,
  remainingCouncils: number,
  logger: ReturnType<typeof createJobLogger>,
  inserted: number,
  skipped: number
): Promise<void> {
  await addJobStats(db, jobId, inserted, skipped);

  // processed_items が total_items に達したかチェック
  const rows = await db
    .select({ processed: scraper_jobs.processed_items, total: scraper_jobs.total_items })
    .from(scraper_jobs)
    .where(eq(scraper_jobs.id, jobId))
    .limit(1);

  const job = rows[0];
  if (job && job.total !== null && job.processed >= job.total) {
    await updateJobStatus(db, jobId, "completed", {
      totalInserted: undefined,
      totalSkipped: undefined,
    });
    await logger("info", `鹿児島 scrape 完了 (全 ${job.total} 件処理済み)`);
  } else if (remainingCouncils <= 1) {
    // フォールバック: remainingCouncils が 0 または 1 なら完了とみなす
    await updateJobStatus(db, jobId, "completed");
    await logger("info", "鹿児島 scrape 完了");
  }
}
