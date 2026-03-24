/**
 * 小布施町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.obuse.nagano.jp/diet/minutes/
 * 自治体コード: 205419
 *
 * 小布施町は公式サイトで PDF のみで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズ:
 *   1. トップページから年度リンクを収集
 *   2. 各年度ページから会議詳細ページ URL を収集
 *   3. 各会議詳細ページから PDF リンクを収集
 *   → 各 PDF を detailParams として返す
 *
 * detail フェーズ:
 *   PDF をダウンロードし MeetingData を組み立てる
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import type { ObusePdfDetailParams } from "./detail";
import { fetchMeetingData, fetchPdfParamsFromDetailPage } from "./detail";
import { fetchSessionList } from "./list";
import { delay } from "./shared";

export const adapter: ScraperAdapter = {
  name: "205419",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    const records: ListRecord[] = [];

    for (const session of sessions) {
      const pdfParams = await fetchPdfParamsFromDetailPage(
        session.detailUrl,
        session.sessionTitle,
      );

      for (const params of pdfParams) {
        records.push({
          detailParams: {
            detailUrl: params.detailUrl,
            sessionTitle: params.sessionTitle,
            pdfUrl: params.pdfUrl,
            heldOnLabel: params.heldOnLabel,
          },
        });
      }

      await delay(1000);
    }

    return records;
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ObusePdfDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
