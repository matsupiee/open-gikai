/**
 * 多賀町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.taga.lg.jp/
 * 自治体コード: 254436
 *
 * 多賀町は公式ウェブサイト上で年度別に会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度一覧ページから年度別ページ URL を取得し、
 * 各年度ページの会議録 PDF リンクを収集する。
 * detail フェーズで各 PDF をダウンロードしてテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingRecords } from "./list";
import { buildMeetingData, type TagaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "254436",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingRecords(year);

    return records.map((r) => ({
      detailParams: {
        sessionTitle: r.sessionTitle,
        pdfUrl: r.pdfUrl,
        linkText: r.linkText,
        meetingType: r.meetingType,
        heldOn: r.heldOn,
        yearPageUrl: r.yearPageUrl,
      } satisfies TagaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as TagaDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
