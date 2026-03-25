/**
 * せたな町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.setana.lg.jp/gikai/kaigiroku/
 * 自治体コード: 013714
 *
 * せたな町は年度別アーカイブ形式の PDF 公開形式であり、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "013714",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((record) => ({
      detailParams: {
        pdfUrl: record.pdfUrl,
        linkText: record.linkText,
        sourcePageUrl: record.sourcePageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const { pdfUrl, linkText, sourcePageUrl } = detailParams as {
      pdfUrl: string;
      linkText: string;
      sourcePageUrl: string;
    };
    return fetchMeetingData(
      { pdfUrl, linkText, sourcePageUrl },
      municipalityCode,
    );
  },
};
