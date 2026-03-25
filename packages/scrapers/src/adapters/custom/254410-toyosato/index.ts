/**
 * 豊郷町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.toyosato.shiga.jp/category/32-5-0-0-0-0-0-0-0-0.html
 * 自治体コード: 254410
 *
 * 豊郷町は公式ウェブサイト上で年度別に会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページから会議詳細ページ URL を取得し、
 * 各詳細ページの会議録 PDF リンクを収集する。
 * detail フェーズで各 PDF をダウンロードしてテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingRecords } from "./list";
import { buildMeetingData, type ToyosatoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "254410",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingRecords(year);

    return records.map((r) => ({
      detailParams: {
        sessionTitle: r.sessionTitle,
        pdfUrl: r.pdfUrl,
        linkText: r.linkText,
        meetingType: r.meetingType,
        heldOn: r.heldOn,
        detailPageUrl: r.detailPageUrl,
      } satisfies ToyosatoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ToyosatoDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
