/**
 * 玉村町議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.tamamura.lg.jp/docs/2019052900044/
 * 自治体コード: 104647
 *
 * 玉村町は Joruri CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別ページから PDF URL を収集し、
 * detail フェーズでは PDF をダウンロードしてテキストを抽出し MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData, type TamamuraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "104647",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        heldOn: m.heldOn,
        pdfUrl: m.pdfUrl,
        meetingType: m.meetingType,
      } satisfies TamamuraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as TamamuraDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
