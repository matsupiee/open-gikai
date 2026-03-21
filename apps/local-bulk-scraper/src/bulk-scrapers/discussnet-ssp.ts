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
  fetchMinuteData,
  buildApiBase,
  extractHost,
} from "@open-gikai/scrapers/discussnet-ssp";
import type { MeetingData } from "@open-gikai/scrapers";

export async function scrapeAll(
  municipalityId: string,
  municipalityName: string,
  baseUrl: string,
  targetYear?: number,
  councilLimit?: number,
  meetingLimit?: number
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

  const councils = await fetchCouncils(tenantId, targetYear, apiBase);
  if (councils.length === 0) {
    console.warn(
      `  [discussnet-ssp] ${municipalityName}: council が見つかりません`
    );
    return results;
  }

  const limitedCouncils = councilLimit
    ? councils.slice(0, councilLimit)
    : councils;

  console.log(
    `  [discussnet-ssp] ${municipalityName}: ${councils.length} 件の council` +
      (councilLimit ? `（${limitedCouncils.length} 件に制限）` : "")
  );

  for (const council of limitedCouncils) {
    if (meetingLimit && results.length >= meetingLimit) break;

    const schedules = await fetchSchedules(
      tenantId,
      council.councilId,
      apiBase
    );
    if (schedules.length === 0) continue;

    const remaining = meetingLimit ? meetingLimit - results.length : schedules.length;
    const limited = schedules.slice(0, remaining);

    for (const schedule of limited) {
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

  if (targetYear) {
    return results.filter(
      (m) => new Date(m.heldOn).getFullYear() === targetYear
    );
  }

  return results;
}
