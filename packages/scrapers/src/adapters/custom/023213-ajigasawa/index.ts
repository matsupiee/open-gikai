/**
 * 鰺ヶ沢町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ajigasawa.lg.jp/about_town/gikai/gikai-kaigiroku.html
 * 自治体コード: 023213
 *
 * 鰺ヶ沢町は町公式サイトで PDF ベースの議事録を公開しており、
 * 単一ページに全年度の PDF リンクがまとまっている。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage, parseDateFromLinkText } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "023213",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        fileKey: m.fileKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      fileKey: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
