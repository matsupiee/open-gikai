/**
 * 曽爾村議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.soni.nara.jp/
 * 一覧ページ: https://www.vill.soni.nara.jp/info/632
 * 自治体コード: 293857
 *
 * 曽爾村は公式サイト内に PDF を直接列挙する形式で議事録を公開している。
 * 専用システムなし・単一ページに全会議録が掲載されるため、カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "293857",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        linkText: m.linkText,
        sessionName: m.sessionName,
        year: m.year,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      linkText: string;
      sessionName: string;
      year: number;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
