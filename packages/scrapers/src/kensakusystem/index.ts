import type { ScraperAdapter, ListRecord } from "../adapter";
import {
  extractSlugFromUrl,
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
  fetchFromSapphire,
  fetchFromCgi,
  fetchFromIndexHtml,
} from "./list";
import { fetchMeetingDataFromSchedule } from "./detail";

export {
  extractSlugFromUrl,
  isSapphireType,
  isCgiType,
  isIndexHtmlType,
  fetchFromSapphire,
  fetchFromCgi,
  fetchFromIndexHtml,
  type KensakusystemSchedule,
} from "./list";

export {
  fetchMeetingDataFromSchedule,
  fetchMeetingStatements,
} from "./detail";

/**
 * baseUrl の URL パターンに応じて適切なフェッチ関数を選択して一覧を取得する。
 */
async function fetchSchedules(baseUrl: string, year: number) {
  if (isSapphireType(baseUrl)) {
    return fetchFromSapphire(baseUrl, year);
  }
  if (isCgiType(baseUrl)) {
    return fetchFromCgi(baseUrl, year);
  }
  if (isIndexHtmlType(baseUrl)) {
    return fetchFromIndexHtml(baseUrl, year);
  }
  const indexUrl = baseUrl.endsWith("/")
    ? `${baseUrl}index.html`
    : `${baseUrl}/index.html`;
  return fetchFromIndexHtml(indexUrl, year);
}

export const adapter: ScraperAdapter = {
  name: "kensakusystem",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const slug = extractSlugFromUrl(baseUrl);
    if (!slug) return [];

    const schedules = await fetchSchedules(baseUrl, year);
    if (!schedules) return [];

    const yearPrefix = String(year);
    const filtered = schedules.filter((s) => s.heldOn.startsWith(yearPrefix));

    return filtered.map((s) => ({
      detailParams: {
        slug,
        title: s.title,
        heldOn: s.heldOn,
        detailUrl: s.url,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { slug, title, heldOn, detailUrl } = detailParams as {
      slug: string;
      title: string;
      heldOn: string;
      detailUrl: string;
    };
    return fetchMeetingDataFromSchedule(
      { title, heldOn, url: detailUrl },
      municipalityId,
      slug
    );
  },
};
