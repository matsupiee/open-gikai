/**
 * 八代市議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.city.yatsushiro.kumamoto.jp/VOICES/
 * 自治体コード: 432024
 *
 * 八代市は独自システム「VOICES/Web」（CGI: voiweb.exe）を使用しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで ACT=100 の全件一覧から FINO・KGNO を収集する。
 * detail フェーズでは ACT=203 で会議録本文 HTML を取得し MeetingData を組み立てる。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type YatsushiroDetailParams } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "432024",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingList(year);

    return records.map((r) => ({
      detailParams: {
        fino: r.fino,
        kgno: r.kgno,
        meetingTitle: r.meetingTitle,
        meetingType: r.meetingType,
        detailUrl: r.detailUrl,
      } satisfies YatsushiroDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as YatsushiroDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
