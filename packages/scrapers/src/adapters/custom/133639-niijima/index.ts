/**
 * 新島村議会 カスタムスクレイピングアダプター
 *
 * サイト: https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council_1.html
 * 自治体コード: 133639
 *
 * DiscussVision 映像配信システム（テナント ID: 188）。
 * テキスト会議録は全期間で未提供のため、fetchDetail は常に null を返す。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NijimaRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "133639",

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

  async fetchDetail({ detailParams, municipalityCode }) {
    const record = detailParams as unknown as NijimaRecord;
    return fetchMeetingData(record, municipalityCode);
  },
};
