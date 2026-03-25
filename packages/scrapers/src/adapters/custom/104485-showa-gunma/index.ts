/**
 * 昭和村議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.vill.showa.gunma.jp/kurashi/gyousei/assembly/kaigiroku.html
 * 自治体コード: 104485
 *
 * 昭和村は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 各定例会ページ → 本文 PDF URL を収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type ShowaGunmaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "104485",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        goNumber: s.goNumber,
        meetingType: s.meetingType,
      } satisfies ShowaGunmaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ShowaGunmaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
