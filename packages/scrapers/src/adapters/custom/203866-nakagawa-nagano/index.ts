/**
 * 中川村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.nakagawa.nagano.jp/site/gikai/list30-185.html
 * 自治体コード: 203866
 *
 * 中川村は自治体公式サイト上の CMS ページに PDF リンクを公開しており、
 * 2段階クロール（一覧ページ → 詳細ページ → PDF）が必要なため
 * カスタムアダプターとして実装する。
 *
 * list フェーズ: 一覧ページ → 各定例会・臨時会の詳細ページ → PDF URL（開催日単位）
 * detail フェーズ: PDF をダウンロード・テキスト抽出して MeetingData を組み立てる
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData, type NakagawaNaganoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203866",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchDocumentList(year);

    return records.map((r) => ({
      detailParams: {
        pdfUrl: r.pdfUrl,
        sessionTitle: r.sessionTitle,
        heldOnLabel: r.heldOnLabel,
      } satisfies NakagawaNaganoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as NakagawaNaganoDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
