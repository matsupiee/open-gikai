/**
 * 小樽市議会 会議録 — ScraperAdapter 実装
 *
 * API: http://local-politics.jp/otaru/api/
 * 自治体コード: 012033
 *
 * 地方議会会議録コーパスプロジェクトが提供する REST API から
 * 発言データを取得する。既存の汎用アダプターでは対応できないため、
 * カスタムアダプターとして実装する。
 *
 * API は1レコード=1発言の形式でデータを返すため、
 * list フェーズで (title, ym) でグルーピングして会議単位にまとめ、
 * detail フェーズで発言を ParsedStatement に変換する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { buildMeetingData } from "./detail";

export { groupByMeeting } from "./list";
export { parseSpeaker, classifyKind, buildStatements } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012033",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        ym: meeting.ym,
        records: meeting.records.map((r) => ({
          speaker: r.speaker,
          text: r.text,
        })),
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      ym: string;
      records: Array<{ speaker: string; text: string }>;
    };
    return buildMeetingData(params, municipalityCode);
  },
};
