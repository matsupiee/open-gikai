/**
 * 丸森町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.marumori.miyagi.jp/town/detail.php?content=451
 * 自治体コード: 043419
 *
 * 丸森町議会は会議録本文（発言録）をオンラインで公開しておらず、
 * 議決結果 PDF と議会中継動画のみが利用可能。
 * 本アダプターでは議決結果一覧ページから PDF リンクを収集し、
 * PDF テキストを発言データとして保存する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type MarumoriDetailParams } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "043419",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        year: r.year,
        dateText: r.dateText,
      } satisfies MarumoriDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MarumoriDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
