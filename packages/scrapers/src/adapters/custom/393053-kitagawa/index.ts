/**
 * 北川村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.kitagawamura.jp/life/list.php?hdnSKBN=B&hdnCat=800
 * 自治体コード: 393053
 *
 * 北川村は村公式サイトに PDF 形式で会期日程・審議結果を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchArticleList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "393053",

  async fetchList({ year }): Promise<ListRecord[]> {
    const articles = await fetchArticleList();

    return articles.map((a) => ({
      detailParams: {
        hdnKey: a.hdnKey,
        title: a.title,
        detailUrl: a.detailUrl,
        year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      hdnKey: string;
      title: string;
      detailUrl: string;
      year: number;
    };
    return fetchMeetingData(
      { hdnKey: params.hdnKey, title: params.title, detailUrl: params.detailUrl },
      municipalityId,
      params.year
    );
  },
};
