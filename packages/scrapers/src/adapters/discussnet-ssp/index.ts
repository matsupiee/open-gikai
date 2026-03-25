import type { ScraperAdapter, ListRecord } from "../adapter";
import { buildApiBase, extractHost } from "./shared";
import { fetchTenantId, fetchCouncils, fetchSchedules } from "./schedule";
import { fetchMinuteData } from "./minute";

export {
  buildApiBase,
  extractHost,
} from "./shared";

export {
  fetchTenantId,
  fetchCouncils,
  fetchSchedules,
  type SspCouncil,
  type SspSchedule,
} from "./schedule";

export {
  fetchMinuteData,
  extractDateFromScheduleName,
} from "./minute";

export const adapter: ScraperAdapter = {
  name: "discussnet_ssp",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    // baseUrl からテナントスラッグを抽出
    const slugMatch = baseUrl.match(/\/tenant\/([^/]+)\//);
    if (!slugMatch?.[1]) {
      throw new Error(
        `DiscussNet SSP: baseUrl からテナントスラッグを抽出できません: ${baseUrl}`
      );
    }
    const tenantSlug = slugMatch[1];

    // 自ホスト版 / smart.discussvision.net の判定
    const isDiscussvision = baseUrl.includes("discussvision.net");
    const isSelfHosted =
      !baseUrl.includes("ssp.kaigiroku.net") && !isDiscussvision;
    const host = isSelfHosted ? extractHost(baseUrl) : undefined;
    const apiBase = isSelfHosted ? buildApiBase(baseUrl) : undefined;

    // tenantId を取得
    let tenantId: number | null;
    if (isDiscussvision) {
      tenantId = await fetchTenantId(tenantSlug);
      if (!tenantId) {
        const tenantJsUrl = baseUrl.replace(/\/rd\/[^/]+$/, "/js/tenant.js");
        tenantId = await fetchTenantId(tenantSlug, undefined, tenantJsUrl);
      }
    } else {
      tenantId = await fetchTenantId(tenantSlug, host);
    }
    if (!tenantId) {
      throw new Error(
        `DiscussNet SSP: tenantId を取得できません (slug=${tenantSlug})`
      );
    }

    // council 一覧を取得（「別冊」は議事録テキストを持たないため除外）
    const allCouncils = await fetchCouncils(tenantId, year, apiBase);
    const councils = allCouncils.filter((c) => !c.name.includes("別冊"));
    if (councils.length === 0) return [];

    // 各 council の schedule 一覧を取得してフラットなリストに展開
    const records: ListRecord[] = [];
    for (const council of councils) {
      const schedules = await fetchSchedules(tenantId, council.councilId, apiBase);
      for (const schedule of schedules) {
        records.push({
          detailParams: {
            tenantId,
            tenantSlug,
            councilId: council.councilId,
            councilName: council.name,
            scheduleId: schedule.scheduleId,
            scheduleName: schedule.name,
            memberList: schedule.memberList,
            apiBase,
            host,
            viewYear: council.viewYear,
          },
        });
      }
    }

    return records;
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const {
      tenantId,
      tenantSlug,
      councilId,
      councilName,
      scheduleId,
      scheduleName,
      memberList,
      apiBase,
      host,
      viewYear,
    } = detailParams as {
      tenantId: number;
      tenantSlug: string;
      councilId: number;
      councilName: string;
      scheduleId: number;
      scheduleName: string;
      memberList: string;
      apiBase?: string;
      host?: string;
      viewYear?: string;
    };

    return fetchMinuteData(
      tenantId,
      tenantSlug,
      councilId,
      councilName,
      { scheduleId, name: scheduleName, memberList },
      municipalityCode,
      { apiBase, host, viewYear }
    );
  },
};
