/**
 * 江差町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.hokkaido-esashi.jp/gikai/gikai.html
 * 自治体コード: 013617
 *
 * 江差町は自治体公式サイトで PDF 形式の会議録を公開しており、
 * Shift_JIS エンコードの静的 HTML サイトから PDF リンクを収集する。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage, parseDetailPage, parseMeetingText } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";
export { yearFromDirName, eraToWesternYear } from "./shared";

export const adapter: ScraperAdapter = {
  name: "013617",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      category: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
