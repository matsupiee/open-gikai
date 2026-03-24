/**
 * 野沢温泉村議会 カスタムスクレイピングアダプター
 *
 * サイト: https://smart.discussvision.net/smart/tenant/nozawaonsen/WebView/rd/council_1.html
 * 自治体コード: 205630
 *
 * DiscussVision 映像配信システム（テナント ID: 602）。
 * テキスト会議録は全期間で未提供のため、fetchDetail は常に null を返す。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NozawaonsenRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "205630",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchDocumentList(year);

    return records.map((record) => ({
      detailParams: {
        councilId: record.councilId,
        scheduleId: record.scheduleId,
        councilLabel: record.councilLabel,
        scheduleLabel: record.scheduleLabel,
        heldOn: record.heldOn,
        meetingType: record.meetingType,
        sourceUrl: record.sourceUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const record = detailParams as unknown as NozawaonsenRecord;
    return fetchMeetingData(record, municipalityId);
  },
};
