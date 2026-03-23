/**
 * 安堵町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ando.nara.jp/category/10-6-3-0-0-0-0-0-0-0.html
 * 自治体コード: 293458
 *
 * 安堵町は公式サイト内に年度別 PDF 一覧を掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 年度ページを辿り、
 * 開催日ごとの PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type AndoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "293458",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        articleId: s.articleId,
      } satisfies AndoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AndoDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
