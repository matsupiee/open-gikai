/**
 * 中城村議会 — detail フェーズ
 *
 * schedule ごとの議事録本文を DiscussNet SSP API から取得し、
 * MeetingData に変換して返す。
 */

import type { MeetingData } from "../../../utils/types";
import { fetchMinuteData } from "../../discussnet-ssp/minute";
import type { NakagusukuListRecord } from "./list";

/**
 * detailParams から MeetingData を組み立てて返す。
 * 発言が空の場合は null を返す。
 */
export async function fetchMeetingData(
  params: NakagusukuListRecord,
  municipalityId: string,
): Promise<MeetingData | null> {
  return fetchMinuteData(
    params.tenantId,
    params.tenantSlug,
    params.councilId,
    params.councilName,
    {
      scheduleId: params.scheduleId,
      name: params.scheduleName,
      memberList: params.memberList,
    },
    municipalityId,
    { viewYear: params.viewYear },
  );
}
