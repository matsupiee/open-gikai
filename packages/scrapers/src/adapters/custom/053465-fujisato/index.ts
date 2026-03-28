/**
 * 藤里町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.fujisato.akita.jp/town/c613/
 * 自治体コード: 053465
 *
 * 藤里町議会は会議録本文ではなく「会議結果」PDF を公開している。
 * 2023年以降は個別記事、2021-2022年はまとめページに PDF が掲載されているため、
 * 両方の導線から PDF を収集してテキストを保存する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type FujisatoDetailParams } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "053465",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        pdfUrl: meeting.pdfUrl,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
      } satisfies FujisatoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as FujisatoDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
