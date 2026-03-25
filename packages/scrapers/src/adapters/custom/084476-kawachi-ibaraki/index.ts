/**
 * 河内町議会（茨城県）— ScraperAdapter 実装
 *
 * サイト: https://www.town.ibaraki-kawachi.lg.jp/page/dir000122.html
 * 自治体コード: 084476
 *
 * 河内町は独立した会議録検索システムを持たず、公式サイト上の年度別ページに
 * PDF リンクが列挙されているためカスタムアダプターとして実装する。
 *
 * list フェーズでインデックスページ → 年度ページを辿り PDF リンクを収集し、
 * detail フェーズで PDF をダウンロード・テキスト抽出して MeetingData を生成する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type KawachiIbarakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "084476",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const pdfs = await fetchPdfList(baseUrl, year);

    return pdfs.map((pdf) => ({
      detailParams: {
        title: pdf.title,
        meetingType: pdf.meetingType,
        pdfUrl: pdf.pdfUrl,
        pdfFileName: pdf.pdfFileName,
        year: pdf.year,
      } satisfies KawachiIbarakiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KawachiIbarakiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
