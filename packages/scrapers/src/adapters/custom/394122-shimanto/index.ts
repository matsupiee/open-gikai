/**
 * 四万十町議会 カスタムスクレイピングアダプター
 *
 * サイト: https://www.town.shimanto.lg.jp/gijiroku/
 * 自治体コード: 394122
 *
 * 独自 PHP による会議録検索システム。
 * 年度切り替えはフォーム POST による動的表示。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { ShimantoRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "394122",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchDocumentList(year);

    return records.map((record) => ({
      detailParams: {
        hdnId: record.hdnId,
        title: record.title,
        heldOn: record.heldOn,
        meetingType: record.meetingType,
        detailUrl: record.detailUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const record = detailParams as unknown as ShimantoRecord;
    return fetchMeetingData(record, municipalityId);
  },
};
