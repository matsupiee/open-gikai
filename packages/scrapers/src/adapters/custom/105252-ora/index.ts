/**
 * 邑楽町議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.ora.gunma.jp/s049/070/020/kaigiroku.html
 * 自治体コード: 105252
 *
 * 邑楽町は独自 CMS による PDF 公開形式で会議録を提供しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "105252",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: "plenary" | "extraordinary";
    };
    return fetchMeetingData(params, municipalityId);
  },
};
