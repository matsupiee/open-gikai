/**
 * 塩竈市議会（宮城県）会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.shiogama.miyagi.jp/life/5/36/182/
 * 自治体コード: 042030
 *
 * 全て PDF 形式で公開。4つの一覧ページから PDF リンクを収集する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "042030",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        yearHeading: m.yearHeading,
        typeHeading: m.typeHeading,
        heldOn: m.heldOn,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(
      detailParams as unknown as Parameters<typeof fetchMeetingData>[0],
      municipalityCode,
    );
  },
};
