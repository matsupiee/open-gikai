/**
 * 江府町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town-kofu.jp/2/1/10/2/
 * 自治体コード: 314030
 *
 * 江府町は町独自 CMS による年度別リンク形式で PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでは 3 段階クロール（トップ → 年度 → 会議サブページ）により
 * 全 PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KofuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "314030",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        externalKey: s.externalKey,
      } satisfies KofuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KofuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
