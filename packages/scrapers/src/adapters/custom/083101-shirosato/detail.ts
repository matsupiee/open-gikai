/**
 * 城里町議会 — detail フェーズ
 *
 * schedule ごとの議事録本文を DiscussNet SSP API から取得し、
 * MeetingData に変換して返す。
 */

import type { MeetingData } from "../../../utils/types";
import { fetchMinuteData } from "../../discussnet-ssp/minute";
import type { ShirosatoListRecord } from "./list";

/**
 * detailParams から MeetingData を組み立てて返す。
 * 発言が空の場合は null を返す。
 */
export async function fetchMeetingData(
  params: ShirosatoListRecord,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const data = await fetchMinuteData(
    params.tenantId,
    params.tenantSlug,
    params.councilId,
    params.councilName,
    {
      scheduleId: params.scheduleId,
      name: params.scheduleName,
      memberList: params.memberList,
    },
    municipalityCode,
    { viewYear: params.viewYear },
  );
  if (!data || data.statements.length === 0) return null;
  return data;
}
