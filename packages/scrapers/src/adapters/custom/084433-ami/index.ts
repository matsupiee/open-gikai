/**
 * 阿見町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ami.lg.jp/0000000309.html
 * 自治体コード: 084433
 *
 * 阿見町は公式サイトの1ページに全年度の会議録 PDF リンクを掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでインデックスページから対象年の PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type AmiDetailParams } from "./detail";

export { parseIndexPage, splitByHeading, extractPdfLinks } from "./list";
export { buildMeetingData, parseSpeaker, classifyKind, parseStatements } from "./detail";

export const adapter: ScraperAdapter = {
  name: "084433",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const pdfs = await fetchPdfList(baseUrl, year);

    return pdfs.map((pdf) => ({
      detailParams: {
        title: pdf.title,
        heldOn: pdf.heldOn,
        pdfUrl: pdf.pdfUrl,
        meetingType: pdf.meetingType,
        fileName: pdf.fileName,
      } satisfies AmiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AmiDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
