/**
 * 鹿児島市議会スクレイパー（ssp.kaigiroku.net API 使用）
 *
 * Flow:
 *   1. councils/index  → 年度別議会一覧
 *   2. minutes/get_schedule → 日程一覧
 *   3. minutes/get_minute   → 議事録本文
 *
 * CFW 互換: fetch のみ使用。
 * Rate limit: リクエスト間に 1.5 秒の遅延を設ける。
 */

import type { MeetingData, Logger, KagoshimaScraperConfig } from "../types";

const API_BASE = "https://ssp.kaigiroku.net/dnp/search";
const TENANT_ID = 539;
const MUNICIPALITY = "鹿児島市";
const PREFECTURE = "鹿児島県";
const DELAY_MS = 1500;

interface CouncilEntry {
  council_id: number;
  name: string;
}

interface CouncilTypeGroup {
  council_type_name1: string | null;
  council_type_name2: string | null;
  council_type_name3: string | null;
  councils: CouncilEntry[];
}

interface YearEntry {
  view_year: string;
  council_type: CouncilTypeGroup[];
}

interface CouncilsIndexResponse {
  councils: Array<{ view_years: YearEntry[] }>;
}

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
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
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

function classifyMeetingType(typeGroups: CouncilTypeGroup[]): string {
  for (const group of typeGroups) {
    const names = [group.council_type_name1, group.council_type_name2, group.council_type_name3]
      .filter(Boolean)
      .join("/");
    if (names.includes("委員会")) return "committee";
    if (names.includes("臨時会")) return "extraordinary";
    if (names.includes("定例会")) return "plenary";
  }
  return "plenary";
}

/**
 * 鹿児島市議会の議事録を取得する。
 * CFW 互換: fetch のみ使用。
 */
export async function scrapeKagoshima(
  config: KagoshimaScraperConfig,
  logger: Logger
): Promise<MeetingData[]> {
  await logger("info", `鹿児島 scrape 開始: ${JSON.stringify(config)}`);

  await delay(DELAY_MS);
  const councilsResp = await apiPost<CouncilsIndexResponse>("councils/index", {
    tenant_id: TENANT_ID,
  });

  if (!councilsResp) {
    await logger("error", "鹿児島: 議会一覧の取得に失敗しました");
    return [];
  }

  const viewYears = councilsResp.councils[0]?.view_years ?? [];
  const filteredViewYears = config.year
    ? viewYears.filter((vy) => Number(vy.view_year) === config.year)
    : viewYears;

  const allCouncils: Array<{ council: CouncilEntry; typeGroups: CouncilTypeGroup[] }> = [];
  for (const yearEntry of filteredViewYears) {
    for (const typeGroup of yearEntry.council_type) {
      for (const council of typeGroup.councils) {
        allCouncils.push({ council, typeGroups: yearEntry.council_type });
      }
    }
  }

  const councilsToProcess = config.limit
    ? allCouncils.slice(0, config.limit)
    : allCouncils;

  await logger("info", `鹿児島: ${councilsToProcess.length} 件の議会セッションを処理します`);

  const results: MeetingData[] = [];

  for (const { council, typeGroups } of councilsToProcess) {
    await logger("info", `鹿児島: 処理中 — ${council.name} (id=${council.council_id})`);

    await delay(DELAY_MS);
    const schedResp = await apiPost<GetScheduleResponse>("minutes/get_schedule", {
      tenant_id: TENANT_ID,
      council_id: council.council_id,
    });

    if (!schedResp || !schedResp.council_schedules.length) {
      await logger("warn", `鹿児島: 議会 ${council.council_id} のスケジュールが見つかりません`);
      continue;
    }

    const meetingType = classifyMeetingType(typeGroups);

    for (const sched of schedResp.council_schedules) {
      await delay(DELAY_MS);
      const minuteResp = await apiPost<GetMinuteResponse>("minutes/get_minute", {
        tenant_id: TENANT_ID,
        council_id: council.council_id,
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

      const heldOn = parseDateFromSchedule(sched.name, council.name);
      if (!heldOn) {
        await logger("warn", `鹿児島: 日付を解析できません — "${sched.name}" / "${council.name}"`);
        continue;
      }

      results.push({
        title: `${council.name}　${sched.name}`,
        meetingType,
        heldOn,
        sourceUrl: `https://ssp.kaigiroku.net/tenant/kagoshima/MinuteView.html?council_id=${council.council_id}&schedule_id=${sched.schedule_id}&minute_id=0`,
        assemblyLevel: "municipal",
        prefecture: PREFECTURE,
        municipality: MUNICIPALITY,
        externalId: `kagoshima_${council.council_id}_${sched.schedule_id}`,
        rawText: combinedText,
      });

      await logger("info", `  → ${heldOn} schedule=${sched.schedule_id} (${minuteResp.tenant_minutes.length} docs)`);
    }
  }

  await logger("info", `鹿児島 scrape 完了: ${results.length} 件`);
  return results;
}
