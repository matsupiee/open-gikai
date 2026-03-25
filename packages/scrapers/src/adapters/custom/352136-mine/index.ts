/**
 * 美祢市議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.city.mine.lg.jp/soshiki/gikai/gijiroku/index.html
 * 自治体コード: 352136
 *
 * 美祢市は市公式サイト内で会議録を PDF 形式で直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズでは PDF をダウンロード・テキスト抽出して
 * ○マーカーで発言を分割し MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type MineDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "352136",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies MineDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MineDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
