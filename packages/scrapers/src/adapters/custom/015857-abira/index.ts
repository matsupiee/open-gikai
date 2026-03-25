/**
 * 安平町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.abira.lg.jp/gyosei/kaigiroku
 * 自治体コード: 015857
 *
 * 安平町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 ID を収集し、各詳細ページから PDF URL を取得する。
 * detail フェーズでは PDF をダウンロードしてテキスト抽出・発言分割を行う。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type AbiraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "015857",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pageId: s.pageId,
      } satisfies AbiraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as AbiraDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
