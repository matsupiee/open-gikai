/**
 * DiscussNet SSP スクレイパー（NTT-AT SaaS 版: ssp.kaigiroku.net）
 *
 * 従来 ASP 版 (discussnet.ts) とは異なり、REST API で議事録を取得する。
 * CFW 互換: fetch のみ使用。Playwright 不使用。
 *
 * API ベース URL: https://ssp.kaigiroku.net/dnp/search/
 *
 * フロー:
 *   1. tenant.js から tenantId を取得
 *   2. councils/index で year に合致する council_id 一覧を取得
 *   3. minutes/get_schedule で council ごとの schedule_id 一覧を取得
 *   4. minutes/get_minute で schedule ごとの議事録本文を取得
 */

import type { MeetingData } from "../utils/types";

const SSP_HOST = "https://ssp.kaigiroku.net";
const API_BASE = `${SSP_HOST}/dnp/search`;
const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

// --- 型定義 ---

export interface SspCouncil {
  councilId: number;
  name: string;
  viewYear: string;
}

export interface SspSchedule {
  scheduleId: number;
  name: string;
  /** member_list HTML (<pre> タグ): 日付情報を含む */
  memberList: string;
}

interface CouncilsApiResponse {
  councils: Array<{
    view_years: Array<{
      view_year: string;
      japanese_year: string;
      council_type: Array<{
        councils: Array<{
          council_id: number;
          name: string;
        }>;
      }>;
    }>;
  }>;
}

interface ScheduleApiResponse {
  council_schedules: Array<{
    schedule_id: number;
    name: string;
    member_list: string;
  }>;
}

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

// --- API 呼び出し ---

/** POST リクエストを送信し、JSON を返す。失敗時は null を返す。 */
async function postJson<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<T | null> {
  const body = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)] as [string, string])
  );
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: body.toString(),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * tenant.js から tenantId を取得する。
 * tenant.js の内容: `dnp.params.tenant_id = 89`
 */
export async function fetchTenantId(
  tenantSlug: string
): Promise<number | null> {
  try {
    const url = `${SSP_HOST}/tenant/${tenantSlug}/js/tenant.js`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/tenant_id\s*=\s*(\d+)/);
    if (!match?.[1]) return null;
    return parseInt(match[1], 10);
  } catch {
    return null;
  }
}

/**
 * 指定した年の council 一覧を取得する。
 * year が undefined の場合は全年を返す。
 */
export async function fetchCouncils(
  tenantId: number,
  year?: number
): Promise<SspCouncil[]> {
  const data = await postJson<CouncilsApiResponse>("councils/index", {
    tenant_id: tenantId,
  });
  if (!data?.councils) return [];

  const result: SspCouncil[] = [];

  for (const councilGroup of data.councils) {
    for (const viewYear of councilGroup.view_years) {
      if (year !== undefined && viewYear.view_year !== String(year)) continue;
      for (const councilType of viewYear.council_type) {
        for (const council of councilType.councils) {
          result.push({
            councilId: council.council_id,
            name: normalizeFullWidth(council.name).trim(),
            viewYear: viewYear.view_year,
          });
        }
      }
    }
  }

  return result;
}

/** schedule 一覧を取得する */
export async function fetchSchedules(
  tenantId: number,
  councilId: number
): Promise<SspSchedule[]> {
  const data = await postJson<ScheduleApiResponse>("minutes/get_schedule", {
    tenant_id: tenantId,
    council_id: councilId,
  });
  if (!data?.council_schedules) return [];

  return data.council_schedules.map((s) => ({
    scheduleId: s.schedule_id,
    name: s.name,
    memberList: s.member_list,
  }));
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
  municipalityName: string,
  prefecture: string
): Promise<MeetingData | null> {
  const data = await postJson<MinuteApiResponse>("minutes/get_minute", {
    tenant_id: tenantId,
    council_id: councilId,
    schedule_id: schedule.scheduleId,
  });
  if (!data?.tenant_minutes) return null;

  // 本文: 議事録タイプの body を結合（目次・名簿は除外、議事録本体のみ）
  const bodyItems = data.tenant_minutes.filter(
    (m) => m.body && m.body.length > 10
  );
  if (bodyItems.length === 0) return null;

  const rawText = bodyItems.map((m) => extractTextFromBody(m.body)).join("\n\n");
  if (!rawText.trim()) return null;

  const heldOn = extractDateFromMemberList(schedule.memberList);
  if (!heldOn) return null;

  const title = `${councilName} ${normalizeScheduleName(schedule.name)}`;
  const externalId = `discussnet_ssp_${tenantId}_${councilId}_${schedule.scheduleId}`;
  const sourceUrl = buildMinuteViewUrl(
    tenantSlug,
    councilId,
    schedule.scheduleId
  );

  return {
    title,
    meetingType: detectMeetingType(councilName),
    heldOn,
    sourceUrl,
    assemblyLevel: "municipal",
    prefecture,
    municipality: municipalityName,
    externalId,
    rawText,
  };
}

// --- 内部ユーティリティ ---

/** <pre> タグや HTML タグを除去してプレーンテキストを抽出する */
function extractTextFromBody(body: string): string {
  return body
    .replace(/<pre[^>]*>/gi, "")
    .replace(/<\/pre>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** member_list テキストから開催日 (YYYY-MM-DD) を抽出する */
function extractDateFromMemberList(memberList: string): string | null {
  const text = normalizeFullWidth(
    memberList.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ")
  );

  // 令和・平成・昭和 + 西暦 両対応
  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };

  for (const [era, base] of Object.entries(wareki)) {
    const m = text.match(
      new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
    );
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

/** "11月27日－01号" → "11月27日 第1日" のように正規化 */
function normalizeScheduleName(name: string): string {
  return normalizeFullWidth(name).trim();
}

function detectMeetingType(councilName: string): string {
  if (councilName.includes("委員会")) return "committee";
  if (councilName.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 全角数字を半角に正規化する */
function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * MinuteView ページの URL を組み立てる。
 * 例: https://ssp.kaigiroku.net/tenant/eniwa/MinuteView.html?council_id=258&schedule_id=2
 */
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
