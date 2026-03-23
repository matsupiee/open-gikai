/**
 * 朝来市議会 会議録検索システム — ScraperAdapter 実装
 *
 * サイト: https://www.voicetechno.net/MinutesSystem/Asago/
 * 自治体コード: 282251
 *
 * VoiceTechno 社製 ASP.NET + DevExpress システム。
 * JavaScript 動的ロードではなく、ASP.NET postback を直接操作して
 * 会議録データを取得するカスタムアダプター。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "282251",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        kind: doc.kind,
        kaisu: doc.kaisu,
        year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { title, heldOn, kind, kaisu, year } = detailParams as {
      title: string;
      heldOn: string;
      kind: string;
      kaisu: string;
      year: number;
    };
    return fetchMeetingData(
      { title, heldOn, kind, kaisu, year },
      municipalityId,
    );
  },
};
