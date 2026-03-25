/**
 * 仁木町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.niki.hokkaido.jp/section/gikai/irv97600000004s6.html
 * 自治体コード: 014079
 *
 * 仁木町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type NikiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014079",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies NikiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as NikiDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
