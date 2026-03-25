/**
 * 白川村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.shirakawa.lg.jp/1098.htm
 * 自治体コード: 216046
 *
 * 白川村議会は発言全文テキスト形式の会議録を公開していないため、
 * fetchDetail は常に null を返す。
 * 詳細は docs/custom-scraping/shirakawa-village.md を参照。
 */

import type { ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";
import type { ShirakawaVillagePdfLink } from "./list";

export const adapter: ScraperAdapter = {
  name: "216046",

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
    const link = detailParams as unknown as ShirakawaVillagePdfLink;
    return fetchMeetingData(link, municipalityCode);
  },
};
