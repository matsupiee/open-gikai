/**
 * 嬬恋村議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.vill.tsumagoi.gunma.jp/www/contents/1000000000443/index.html
 * 自治体コード: 104256
 *
 * 嬬恋村は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで単一の一覧ページから PDF URL を収集し、
 * detail フェーズでは PDF をダウンロードしてテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type TsumagoiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "104256",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        month: s.month,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies TsumagoiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TsumagoiDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
