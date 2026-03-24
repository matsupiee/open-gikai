/**
 * 長井市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/index.html
 * 自治体コード: 062090
 *
 * 長井市は独自 CMS で PDF ベースの議事録を公開しており、
 * 3階層構造（トップ → 年度 → 会期別）のためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseTopPage, parseYearPage, parseSessionPage } from "./list";
export { parseDateFromFilename, parseEraYear } from "./shared";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "062090",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionName: m.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
