/**
 * 妹背牛町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/
 * 自治体コード: 014338
 *
 * 妹背牛町は独自 CMS を使用しており、既存の汎用アダプターでは対応できないため
 * カスタムアダプターとして実装する。
 *
 * 公開形式:
 *   - HTML 詳細ページ → PDF（平成28年〜現在）
 *   - 直接 PDF リンク（一覧ページから直接）
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014338",

  async fetchList({ year }): Promise<ListRecord[]> {
    const links = await fetchDocumentList(year);

    return links.map((link) => ({
      detailParams: {
        url: link.url,
        format: link.format,
        title: link.title,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { url, format, title } = detailParams as {
      url: string;
      format: "html" | "pdf";
      title: string;
    };
    return fetchMeetingData({ url, format, title }, municipalityId);
  },
};
