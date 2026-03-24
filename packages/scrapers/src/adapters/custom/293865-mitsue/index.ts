/**
 * 御杖村議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.mitsue.nara.jp/
 * 一覧ページ: https://www.vill.mitsue.nara.jp/kurashi/annai/gikaijimukyoku/1/1/336.html
 * 自治体コード: 293865
 *
 * 御杖村は公式サイト内に PDF を直接列挙する形式で議事録を公開している。
 * 専用システムなし・単一ページに全会議録が掲載されるため、カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "293865",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
