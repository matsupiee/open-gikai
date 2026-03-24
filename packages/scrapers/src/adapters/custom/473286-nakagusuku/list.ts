/**
 * 中城村議会 — list フェーズ
 *
 * DiscussNet SSP API から指定年の会議（council）一覧を取得し、
 * 各 schedule を ListRecord として返す。
 */

import { fetchCouncils, fetchSchedules } from "../../discussnet-ssp/schedule";
import type { ListRecord } from "../../adapter";
import { TENANT_ID, TENANT_SLUG } from "./shared";

export interface NakagusukuListRecord {
  tenantId: number;
  tenantSlug: string;
  councilId: number;
  councilName: string;
  scheduleId: number;
  scheduleName: string;
  memberList: string;
  viewYear: string;
}

/**
 * 指定年の全 schedule を取得し、ListRecord の配列として返す。
 */
export async function fetchMeetingList(year: number): Promise<ListRecord[]> {
  const councils = await fetchCouncils(TENANT_ID, year);
  if (councils.length === 0) return [];

  const records: ListRecord[] = [];

  for (const council of councils) {
    const schedules = await fetchSchedules(TENANT_ID, council.councilId);
    for (const schedule of schedules) {
      const params: Record<string, unknown> = {
        tenantId: TENANT_ID,
        tenantSlug: TENANT_SLUG,
        councilId: council.councilId,
        councilName: council.name,
        scheduleId: schedule.scheduleId,
        scheduleName: schedule.name,
        memberList: schedule.memberList,
        viewYear: council.viewYear,
      };
      records.push({ detailParams: params });
    }
  }

  return records;
}
