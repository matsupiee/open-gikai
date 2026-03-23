/**
 * 大山町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.daisen.jp/gikai/9/
 * 自治体コード: 313866
 *
 * 大山町は PDF 形式で会議録を公開しており、
 * 3階層のナビゲーション（トップ → 年度 → 定例会サブページ）を
 * 辿って PDF を取得するカスタムアダプター。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseTopPage, parseYearPage, parseSubPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "313866",

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
      heldOn: string;
      meetingType: string;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        heldOn: params.heldOn,
        meetingType: params.meetingType,
      },
      municipalityId,
    );
  },
};
