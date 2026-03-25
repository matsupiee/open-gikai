/**
 * 信濃町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.shinano.lg.jp/chosei/gikai/
 * 自治体コード: 205834
 *
 * 信濃町は SHIRASAGI CMS で PDF/DOC/DOCX ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "205834",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const files = await fetchMeetingList(baseUrl, year);

    return files.map((f) => ({
      detailParams: {
        fileUrl: f.fileUrl,
        fileType: f.fileType,
        title: f.title,
        year: f.year,
        heldOn: f.heldOn,
        meetingType: f.meetingType,
        sessionNumber: f.sessionNumber,
        month: f.month,
        memberName: f.memberName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      fileUrl: string;
      fileType: "pdf" | "doc" | "docx";
      title: string;
      year: number | null;
      heldOn: string | null;
      meetingType: string;
      sessionNumber: string | null;
      month: number | null;
      memberName: string | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
