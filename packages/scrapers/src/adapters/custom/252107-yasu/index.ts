/**
 * 野洲市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.yasu.lg.jp/gyoseijoho/gikai/teireikai-rinjikaikaigiroku/index.html
 * 自治体コード: 252107
 *
 * 野洲市は公式ウェブサイト上で年度別に会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでインデックスページから年度別ページ URL を取得し、
 * 各年度ページから会議録 PDF リンクを収集する。
 * detail フェーズで各 PDF をダウンロードしてテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingRecords } from "./list";
import { buildMeetingData, type YasuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "252107",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingRecords(year);

    return records.map((r) => ({
      detailParams: {
        sessionTitle: r.sessionTitle,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        heldOn: r.heldOn,
        yearPageUrl: r.yearPageUrl,
      } satisfies YasuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as YasuDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
