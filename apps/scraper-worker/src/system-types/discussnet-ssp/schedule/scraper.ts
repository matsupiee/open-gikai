/**
 * DiscussNet SSP スクレイパー — schedule フェーズ
 *
 * tenant.js から tenantId を取得し、council 一覧・schedule 一覧を取得する。
 */

import { postJson, normalizeFullWidth, SSP_HOST, USER_AGENT } from "../_shared";

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
