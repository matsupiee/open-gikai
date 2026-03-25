/**
 * 氷川町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.hikawa.kumamoto.jp/gikai/list00412.html
 * 自治体コード: 434680
 *
 * 氷川町は公式サイトで PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別一覧 → 詳細ページ → PDF URL を収集する。
 * detail フェーズでは複数 PDF をダウンロードし MeetingData を組み立てる。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type HikawaDetailParams } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "434680",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    // 同一会議の複数 PDF をグループ化する
    const grouped = new Map<
      string,
      { title: string; meetingType: string; detailPageUrl: string; pdfUrls: { pdfUrl: string; pdfLabel: string }[] }
    >();

    for (const r of records) {
      const key = r.detailPageUrl;
      if (!grouped.has(key)) {
        grouped.set(key, {
          title: r.title,
          meetingType: r.meetingType,
          detailPageUrl: r.detailPageUrl,
          pdfUrls: [],
        });
      }
      grouped.get(key)!.pdfUrls.push({
        pdfUrl: r.pdfUrl,
        pdfLabel: r.pdfLabel,
      });
    }

    return Array.from(grouped.values()).map((g) => ({
      detailParams: {
        title: g.title,
        pdfUrls: g.pdfUrls,
        meetingType: g.meetingType,
        detailPageUrl: g.detailPageUrl,
      } satisfies HikawaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as HikawaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
