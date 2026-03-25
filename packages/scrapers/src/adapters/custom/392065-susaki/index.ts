/**
 * 須崎市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.susaki.lg.jp/gijiroku/
 * 自治体コード: 392065
 *
 * 須崎市は独自 CMS で PDF 形式の会議録を公開している。
 * 年度切り替えが JavaScript フォーム送信のため、POST リクエストで対応する。
 *
 * スクレイピング戦略:
 * 1. 年度 × カテゴリ（3000=本会議, 4000=委員会）の組み合わせで一覧ページを POST 取得
 * 2. giji_dtl.php リンクから hdnID を収集
 * 3. 詳細ページから PDF リンクとメタ情報を取得
 * 4. PDF をダウンロードしてテキスト抽出・発言解析
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchAllMeetingData } from "./detail";
import type { SusakiListItem } from "./list";

export const adapter: ScraperAdapter = {
  name: "392065",

  async fetchList({ year }): Promise<ListRecord[]> {
    const items = await fetchMeetingList(year);

    return items.map((item) => ({
      detailParams: {
        hdnId: item.hdnId,
        category: item.category,
        meetingName: item.meetingName,
        detailUrl: item.detailUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const item = detailParams as unknown as SusakiListItem;
    const meetings = await fetchAllMeetingData(item, municipalityCode);

    // ScraperAdapter は MeetingData | null を返す仕様のため、最初の1件を返す
    // 委員会の複数 PDF 対応は将来的な拡張として保留
    return meetings[0] ?? null;
  },
};
