/**
 * 小鹿野町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ogano.lg.jp/menyu/gikai/sinkaigiroku/index.html
 * 自治体コード: 113654
 *
 * 小鹿野町は独自 HTML（フレームセット構成・Shift_JIS）で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "113654",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        mainUrl: m.mainUrl,
        fileName: m.fileName,
        title: m.title,
        heldOn: m.heldOn,
        sessionType: m.sessionType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      mainUrl: string;
      fileName: string;
      title: string;
      heldOn: string;
      sessionType: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
