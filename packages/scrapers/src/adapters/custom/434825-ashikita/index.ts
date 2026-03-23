/**
 * 芦北町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ashikita.lg.jp/
 * 自治体コード: 434825
 *
 * 芦北町は公式サイトで PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別インデックス → 年度別会議録一覧を辿り、
 * PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type AshikitaDetailParams } from "./detail";

export { parseYearIndexLinks, parseListPageUrl, parsePdfLinks } from "./list";
export {
  buildMeetingData,
  estimateHeldOn,
  parseSpeaker,
  classifyKind,
  parseStatements,
} from "./detail";

export const adapter: ScraperAdapter = {
  name: "434825",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        year: r.year,
        yearSlug: r.yearSlug,
      } satisfies AshikitaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AshikitaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
