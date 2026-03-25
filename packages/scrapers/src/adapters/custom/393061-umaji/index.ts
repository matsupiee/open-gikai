/**
 * 馬路村議会 — ScraperAdapter 実装
 *
 * サイト: https://vill.umaji.lg.jp/about/category/parliament/
 * 自治体コード: 393061
 *
 * 馬路村は WordPress サイトに PDF 形式で議会情報を公開しており、
 * 会議録（発言録）のオンライン公開はない。
 * カテゴリページ → 投稿ページ → PDF の3段階でクロールし、
 * PDF メタ情報（タイトル・日付）から MeetingData を生成する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfEntries } from "./list";
import { buildMeetingData } from "./detail";
import type { UmajiPdfEntry } from "./list";

export const adapter: ScraperAdapter = {
  name: "393061",

  async fetchList({ year }): Promise<ListRecord[]> {
    const entries = await fetchPdfEntries();

    return entries.map((entry) => ({
      detailParams: {
        pdfUrl: entry.pdfUrl,
        label: entry.label,
        postUrl: entry.postUrl,
        postTitle: entry.postTitle,
        year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      label: string;
      postUrl: string;
      postTitle: string;
      year: number;
    };

    const entry: UmajiPdfEntry = {
      pdfUrl: params.pdfUrl,
      label: params.label,
      postUrl: params.postUrl,
      postTitle: params.postTitle,
    };

    return buildMeetingData(entry, municipalityId, params.year);
  },
};
