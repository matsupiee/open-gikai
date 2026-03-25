/**
 * 竜王町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ryuoh.shiga.jp/parliament/gijiroku/gijiroku.html
 * 自治体コード: 253847
 *
 * 竜王町は公式ウェブサイト上で会議録 PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで2つの一覧ページから PDF リンクを収集し、
 * detail フェーズで各 PDF をダウンロードしてテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingRecords } from "./list";
import { buildMeetingData, type RyuoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "253847",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingRecords(year);

    return records.map((r) => ({
      detailParams: {
        pdfUrl: r.pdfUrl,
        linkText: r.linkText,
        sessionTitle: r.sessionTitle,
        meetingType: r.meetingType,
        year: r.year,
        session: r.session,
        day: r.day,
        sourceListUrl: r.sourceListUrl,
      } satisfies RyuoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as RyuoDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
