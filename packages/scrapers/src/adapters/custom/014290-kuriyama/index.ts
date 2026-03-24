/**
 * 栗山町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kuriyama.hokkaido.jp/site/gikai/7389.html
 * 自治体コード: 014290
 *
 * 栗山町は独自 CMS を使用しており、既存の汎用アダプターでは対応できないため
 * カスタムアダプターとして実装する。
 *
 * 公開形式:
 *   - HTML 形式（定例会、Shift_JIS フレームセット）
 *   - PDF 形式（臨時会中心）
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMinutesLinks } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014290",

  async fetchList({ year }): Promise<ListRecord[]> {
    const links = await fetchMinutesLinks(year);

    return links.map((link) => ({
      detailParams: {
        url: link.url,
        format: link.format,
        title: `${link.yearLabel}${link.sessionName}`,
        sessionName: link.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { url, format, title, sessionName } = detailParams as {
      url: string;
      format: "html" | "pdf";
      title: string;
      sessionName: string;
    };
    return fetchMeetingData({ url, format, title, sessionName }, municipalityId);
  },
};
