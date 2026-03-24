/**
 * 中之条町議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.nakanojo.gunma.jp/site/nakanojo-gikai/1097.html
 * 自治体コード: 104213
 *
 * 単一の一覧ページから PDF URL を収集し、
 * PDF をダウンロード・テキスト抽出して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData, type NakanojoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "104213",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => {
      // heldOn を構築: 年月日が揃っていれば YYYY-MM-DD、月のみなら YYYY-MM-01
      let heldOn: string | null = null;
      if (s.month !== null) {
        const mm = String(s.month).padStart(2, "0");
        const dd = s.day !== null ? String(s.day).padStart(2, "0") : "01";
        heldOn = `${s.year}-${mm}-${dd}`;
      }

      return {
        detailParams: {
          pdfUrl: s.pdfUrl,
          title: s.title,
          heldOn,
          meetingType: s.meetingType,
        } satisfies NakanojoDetailParams,
      };
    });
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as NakanojoDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
