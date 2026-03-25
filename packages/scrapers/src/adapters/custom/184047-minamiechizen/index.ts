/**
 * 南越前町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/index.html
 * 自治体コード: 184047
 *
 * 南越前町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別インデックスページから全会議録リンクを収集し、
 * detail フェーズで各 PDF を取得してテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData, type MinamiechizeDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "184047",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        detailUrl: m.detailUrl,
        pdfUrl: m.pdfUrl,
        pageId: m.pageId,
        nendoCode: m.nendoCode,
        meetingType: m.meetingType,
        heldOn: m.heldOn,
      } satisfies MinamiechizeDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MinamiechizeDetailParams;
    return await fetchMeetingData(params, municipalityCode);
  },
};
