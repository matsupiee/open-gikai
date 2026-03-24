/**
 * 本山町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/index.html
 * 自治体コード: 393410
 *
 * 本山町は自治体公式サイトに PDF 形式で会議録を直接掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "393410",

  async fetchList({ year }): Promise<ListRecord[]> {
    const entries = await fetchDocumentList(year);

    return entries.map((entry) => ({
      detailParams: { entry, year },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      entry: import("./list").MotoyamaPdfEntry;
      year: number;
    };
    return fetchMeetingData(params.entry, municipalityId);
  },
};
