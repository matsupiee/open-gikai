/**
 * 築上町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.chikujo.fukuoka.jp/li/020/070/040/index.html
 * 自治体コード: 406473
 *
 * 築上町は自治体 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData, type ChikujoDetailParams } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "406473",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        heldOn: meeting.heldOn,
        pdfUrl: meeting.pdfUrl,
        meetingType: meeting.meetingType,
        pageUrl: meeting.pageUrl,
      } satisfies ChikujoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ChikujoDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
