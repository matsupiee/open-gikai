/**
 * むかわ町議会 — ScraperAdapter 実装
 *
 * サイト: http://www.town.mukawa.lg.jp/2872.htm
 * 自治体コード: 015865
 *
 * むかわ町は自治体 CMS（i-SITE PORTAL）で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで単一ページから全 PDF リンクを収集し、
 * detail フェーズで各 PDF をダウンロードしてテキスト抽出・発言分割を行う。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type MukawaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "015865",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        fileName: s.fileName,
      } satisfies MukawaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MukawaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
