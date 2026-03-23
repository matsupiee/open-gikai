/**
 * 上天草市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.kamiamakusa.kumamoto.jp/
 * 自治体コード: 432121
 *
 * 上天草市は市公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページをページネーションで辿り、
 * 各会期の詳細ページ URL・タイトル・掲載日を収集する。
 * detail フェーズでは詳細ページから PDF リンクを抽出し、
 * 各 PDF をダウンロード・テキスト抽出して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KamiamakusaDetailParams } from "./detail";
import { fetchPage } from "./shared";

export const adapter: ScraperAdapter = {
  name: "432121",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        id: s.id,
        title: s.title,
        postedOn: s.postedOn,
        detailUrl: s.detailUrl,
      } satisfies KamiamakusaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KamiamakusaDetailParams;

    const html = await fetchPage(params.detailUrl);
    if (!html) return null;

    return buildMeetingData(params, municipalityId, html);
  },
};
