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
 *
 * 旧 handler と同様に targetYear は渡さず全件取得 → client-side でフィルタする。
 * （fetchFromSapphire 等の targetYear は navigateTreedepths の ±1年 フィルタに使われるため、
 *   渡すと微妙な動作変更になる）
 */
async function fetchSchedules(baseUrl: string) {
  if (isSapphireType(baseUrl)) {
    return fetchFromSapphire(baseUrl);
  }
  if (isCgiType(baseUrl)) {
    return fetchFromCgi(baseUrl);
  }
  if (isIndexHtmlType(baseUrl)) {
    return fetchFromIndexHtml(baseUrl);
  }
  const indexUrl = baseUrl.endsWith("/")
    ? `${baseUrl}index.html`
    : `${baseUrl}/index.html`;
  return fetchFromIndexHtml(indexUrl);
}

export const adapter: ScraperAdapter = {
  name: "kensakusystem",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const slug = extractSlugFromUrl(baseUrl);
    if (!slug) {
      throw new Error(`kensakusystem: baseUrl から slug を抽出できません: ${baseUrl}`);
    }

    const schedules = await fetchSchedules(baseUrl);
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

  async fetchDetail({ detailParams, municipalityCode }) {
    const { slug, title, heldOn, detailUrl } = detailParams as {
      slug: string;
      title: string;
      heldOn: string;
      detailUrl: string;
    };
    return fetchMeetingDataFromSchedule(
      { title, heldOn, url: detailUrl },
      municipalityCode,
      slug
    );
  },
};
