/**
 * 今帰仁村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.nakijin.jp/pagtop/gyosei/songikai/1281.html
 * 自治体コード: 473065
 *
 * 議事録トップページ → 年度別一覧ページ → PDF リンクの順に辿り、
 * 各 PDF をダウンロード・テキスト抽出して発言データを生成する。
 *
 * - 会議録はすべて PDF 形式
 * - 年度別一覧ページの URL は固定ではなくトップページからリンクを辿って取得
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NakijinMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "473065",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        fileUrl: meeting.fileUrl,
        title: meeting.title,
        year: meeting.year,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
        sourcePageUrl: meeting.sourcePageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const meeting = detailParams as unknown as NakijinMeeting;
    return fetchMeetingData(meeting, municipalityId);
  },
};
