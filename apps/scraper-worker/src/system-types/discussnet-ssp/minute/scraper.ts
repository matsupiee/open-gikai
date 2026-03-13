/**
 * DiscussNet SSP スクレイパー — minute フェーズ
 *
 * schedule_id ごとに議事録本文を取得し、MeetingData に変換する。
 */

import type { MeetingData } from "../../../utils/types";
import { postJson, normalizeFullWidth, SSP_HOST } from "../_shared";
import type { SspSchedule } from "../schedule/scraper";

interface MinuteItem {
  minute_id: number;
  title: string;
  body: string;
  minute_type: string;
  minute_type_code: number;
}

interface MinuteApiResponse {
  tenant_minutes: MinuteItem[];
}

/**
 * 指定 schedule の議事録本文を取得し、MeetingData に変換して返す。
 * 本文が空の場合は null を返す。
 */
export async function fetchMinuteData(
  tenantId: number,
  tenantSlug: string,
  councilId: number,
  councilName: string,
  schedule: SspSchedule,
  municipalityId: string
): Promise<MeetingData | null> {
  const data = await postJson<MinuteApiResponse>("minutes/get_minute", {
    tenant_id: tenantId,
    council_id: councilId,
    schedule_id: schedule.scheduleId,
  });
  if (!data?.tenant_minutes) return null;

  const bodyItems = data.tenant_minutes.filter(
    (m) => m.body && m.body.length > 10
  );
  if (bodyItems.length === 0) return null;

  const rawText = bodyItems
    .map((m) => extractTextFromBody(m.body))
    .join("\n\n");
  if (!rawText.trim()) return null;

  const heldOn = extractDateFromMemberList(schedule.memberList);
  if (!heldOn) return null;

  const title = `${councilName} ${normalizeScheduleName(schedule.name)}`;
  const externalId = `discussnet_ssp_${tenantId}_${councilId}_${schedule.scheduleId}`;
  const sourceUrl = buildMinuteViewUrl(tenantSlug, councilId, schedule.scheduleId);

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(councilName),
    heldOn,
    sourceUrl,
    externalId,
    rawText,
  };
}

// --- 内部ユーティリティ ---

function extractTextFromBody(body: string): string {
  return body
    .replace(/<pre[^>]*>/gi, "")
    .replace(/<\/pre>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractDateFromMemberList(memberList: string): string | null {
  const text = normalizeFullWidth(
    memberList.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ")
  );

  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const [era, base] of Object.entries(wareki)) {
    const m = text.match(new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`));
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  const m = text.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

function normalizeScheduleName(name: string): string {
  return normalizeFullWidth(name).trim();
}

function detectMeetingType(councilName: string): string {
  if (councilName.includes("委員会")) return "committee";
  if (councilName.includes("臨時会")) return "extraordinary";
  return "plenary";
}

function buildMinuteViewUrl(
  tenantSlug: string,
  councilId: number,
  scheduleId: number
): string {
  const url = new URL(`${SSP_HOST}/tenant/${tenantSlug}/MinuteView.html`);
  url.searchParams.set("council_id", String(councilId));
  url.searchParams.set("schedule_id", String(scheduleId));
  return url.toString();
}
