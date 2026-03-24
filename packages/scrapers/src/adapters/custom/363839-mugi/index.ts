/**
 * 牟岐町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tokushima-mugi.lg.jp/soshiki/mugi/gikaijimukyoku/
 * 自治体コード: 363839
 *
 * 牟岐町は独自 CMS により会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで定例会カテゴリ一覧ページをページネーションに従ってクロールし、
 * 各会議詳細ページの PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * 「氏名＋役職」パターンで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData } from "./detail";
import type { MugiPdfRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "363839",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchDocumentList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfLabel: r.pdfLabel,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        docId: r.docId,
        heldOn: r.heldOn,
      } satisfies MugiPdfRecord,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as MugiPdfRecord;
    return buildMeetingData(params, municipalityId);
  },
};
