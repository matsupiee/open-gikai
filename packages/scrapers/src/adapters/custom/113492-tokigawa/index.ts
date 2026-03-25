/**
 * ときがわ町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tokigawa.lg.jp/div/203010/htm/gijiroku/index.html
 * 自治体コード: 113492
 *
 * ときがわ町は独自静的 HTML（Shift_JIS）で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "113492",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        fileUrl: m.fileUrl,
        yearDir: m.yearDir,
        fileName: m.fileName,
        heldOn: m.heldOn,
        linkText: m.linkText,
        meetingTitle: m.meetingTitle,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      fileUrl: string;
      yearDir: string;
      fileName: string;
      heldOn: string;
      linkText: string;
      meetingTitle: string;
      year: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
