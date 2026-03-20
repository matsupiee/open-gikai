/**
 * discussnet-ssp バルクスクレイパー
 *
 * fetchTenantId() → fetchCouncils() → 各 council で fetchSchedules()
 * → 各 schedule で fetchMinuteData() → MeetingData[]
 */

import {
  fetchTenantId,
  fetchCouncils,
  fetchSchedules,
} from "../../system-types/discussnet-ssp/schedule/scraper";
import { fetchMinuteData } from "../../system-types/discussnet-ssp/minute/scraper";
import {
  buildApiBase,
  extractHost,
} from "../../system-types/discussnet-ssp/_shared";
import type { MeetingData } from "../../utils/types";

export async function scrapeAll(
  municipalityId: string,
  municipalityName: string,
  baseUrl: string
): Promise<MeetingData[]> {
  const results: MeetingData[] = [];

  const slugMatch = baseUrl.match(/\/tenant\/([^/]+)\//);
  if (!slugMatch?.[1]) {
    console.warn(
      `  [discussnet-ssp] ${municipalityName}: テナントスラッグ抽出失敗`
    );
    return results;
  }
  const tenantSlug = slugMatch[1];

  const isSelfHosted = !baseUrl.includes("ssp.kaigiroku.net");
  const host = isSelfHosted ? extractHost(baseUrl) : undefined;
  const apiBase = isSelfHosted ? buildApiBase(baseUrl) : undefined;

  const tenantId = await fetchTenantId(tenantSlug, host);
  if (!tenantId) {
    console.warn(
      `  [discussnet-ssp] ${municipalityName}: tenantId 取得失敗`
    );
    return results;
  }

  // 全年の council を取得
  const councils = await fetchCouncils(tenantId, undefined, apiBase);
  if (councils.length === 0) {
    console.warn(
      `  [discussnet-ssp] ${municipalityName}: council が見つかりません`
    );
    return results;
  }

  console.log(
    `  [discussnet-ssp] ${municipalityName}: ${councils.length} 件の council`
  );

  for (const council of councils) {
    const schedules = await fetchSchedules(
      tenantId,
      council.councilId,
      apiBase
    );
    if (schedules.length === 0) continue;

    for (const schedule of schedules) {
      const meeting = await fetchMinuteData(
        tenantId,
        tenantSlug,
        council.councilId,
        council.name,
        schedule,
        municipalityId,
        { apiBase, host }
      );
      if (meeting) {
        results.push(meeting);
      }
    }
  }

  return results;
}
