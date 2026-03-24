/**
 * 高取町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.takatori.nara.jp/
 * 一覧ページ: https://www.town.takatori.nara.jp/category_list.php?frmCd=1-1-5-0-0
 * 自治体コード: 294012
 *
 * 高取町は独自 PHP システム（category_list.php / contents_detail.php）で
 * 会議録 PDF を公開。全年度分がトップページに一覧表示される。
 * 各会議の詳細ページから PDF リンクを収集する 2 段階方式。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchSessionList } from "./list";
import type { TakatoriPdfInfo, TakatoriSession } from "./list";

export const adapter: ScraperAdapter = {
  name: "294012",

  async fetchList({ baseUrl: _baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    const records: ListRecord[] = [];
    for (const session of sessions) {
      for (const pdf of session.pdfs) {
        records.push({
          detailParams: {
            session: {
              title: session.title,
              meetingType: session.meetingType,
              year: session.year,
              frmId: session.frmId,
              pdfs: session.pdfs,
            } satisfies TakatoriSession,
            pdf: {
              pdfUrl: pdf.pdfUrl,
              label: pdf.label,
            } satisfies TakatoriPdfInfo,
          },
        });
      }
    }

    return records;
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const session = detailParams.session as TakatoriSession;
    const pdf = detailParams.pdf as TakatoriPdfInfo;

    return fetchMeetingData({ session, pdf, municipalityId });
  },
};
