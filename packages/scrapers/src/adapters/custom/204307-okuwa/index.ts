/**
 * 大桑村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.okuwa.lg.jp/okuwa/gikai/index.html
 * 自治体コード: 204307
 *
 * 大桑村は公式サイトで議会だより PDF のみを公開しており、
 * 会議録テキスト（HTML）の公開はないため、カスタムアダプターとして実装する。
 *
 * list フェーズで 3 つの一覧ページから PDF URL を収集する。
 * detail フェーズでは PDF をダウンロードし MeetingData を組み立てる。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "204307",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfUrl: r.pdfUrl,
        issuedOn: r.issuedOn,
        sourceUrl: `https://www.vill.okuwa.lg.jp/okuwa/gikai/gikaidayori/gikaidayori.html`,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      title: string;
      pdfUrl: string;
      issuedOn: string;
      sourceUrl: string;
    };
    return buildMeetingData(params, municipalityId);
  },
};
