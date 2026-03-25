/**
 * 新温泉町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.shinonsen.hyogo.jp/page/index.php?mode=page_list&cate_id=C2608
 * 自治体コード: 285862
 *
 * 新温泉町は公式サイト内で会議録を PDF 形式で公開しており、
 * 年度別ページ（jQuery accordion）から PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData, type ShinonsenDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "285862",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionName: s.sessionName,
      } satisfies ShinonsenDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ShinonsenDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
