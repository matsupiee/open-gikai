/**
 * 姫島村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.himeshima.jp/about/son-gikai/
 * 自治体コード: 443221
 *
 * 現状は発言全文付き会議録を確認できないため、
 * fetchDetail は常に null を返す。
 */

import type { ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";
import type { HimeshimaDocumentLink } from "./list";

export const adapter: ScraperAdapter = {
  name: "443221",

  async fetchList({ baseUrl, year }) {
    const links = await fetchDocumentList(baseUrl, year);

    return links.map((link) => ({
      detailParams: {
        pdfUrl: link.pdfUrl,
        linkText: link.linkText,
        kind: link.kind,
        year: link.year,
        heldOn: link.heldOn,
        title: link.title,
        meetingType: link.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const link = detailParams as unknown as HimeshimaDocumentLink;
    return fetchMeetingData(link, municipalityCode);
  },
};
