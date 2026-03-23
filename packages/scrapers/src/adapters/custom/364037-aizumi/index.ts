/**
 * 藍住町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.aizumi.lg.jp/gikai/minutes/
 * 自治体コード: 364037
 *
 * 藍住町は町公式サイトで会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年別ページから PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type AizumiDetailParams } from "./detail";

export { parseYearPage, parseSessionFromLinkText } from "./list";
export { buildMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "364037",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pdfPath: s.pdfPath,
      } satisfies AizumiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AizumiDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
