/**
 * 笠置町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kasagi.lg.jp/soshiki_view.php?so_cd1=2&so_cd2=0&so_cd3=0&so_cd4=0&so_cd5=0&bn_cd=5
 * 自治体コード: 263648
 *
 * 笠置町は公式サイト内の年度ページ・詳細ページ・PDF 添付で会議録を公開しており、
 * 汎用アダプターでは扱えないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "263648",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        detailPageUrl: meeting.detailPageUrl,
        pdfUrl: meeting.pdfUrl,
        linkLabel: meeting.linkLabel,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      detailPageUrl: string;
      pdfUrl: string;
      linkLabel: string;
    };

    return fetchMeetingData(params, municipalityCode);
  },
};
