/**
 * 美馬市議会（徳島県） — ScraperAdapter 実装
 *
 * サイト: https://www.city.mima.lg.jp/gyosei/shisei/gikai/kaigiroku/
 * 自治体コード: 362077
 *
 * 美馬市は市公式サイト上で PDF 形式の会議録を直接公開している。
 * 一覧ページ（2ページ構成）から年度別ページへ遷移し、各 PDF を直接ダウンロードする方式。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "362077",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { pdfUrl, title, heldOn } = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
    };
    return fetchMeetingData({ pdfUrl, title, heldOn }, municipalityId);
  },
};
