/**
 * 赤井川村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.akaigawa.com/kurashi/gikai_jimukyoku/post_95.html
 * 自治体コード: 014095
 *
 * 赤井川村は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type AkaigawaDetailParams } from "./detail";

export { parseLinkText, parseListPage } from "./list";
export { buildMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014095",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies AkaigawaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AkaigawaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
