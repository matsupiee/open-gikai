/**
 * つがる市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.tsugaru.aomori.jp/soshiki/shigikai/kaigiroku/index.html
 * 自治体コード: 022098
 *
 * つがる市は会議録をすべて PDF 形式で公開している。
 * 年度別ページ ID 一覧からリンクを収集し、PDF をダウンロードしてテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData, type TsugaruDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "022098",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        heldOn: s.heldOn,
        meetingType: s.meetingType,
        pdfUrl: s.pdfUrl,
      } satisfies TsugaruDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TsugaruDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
