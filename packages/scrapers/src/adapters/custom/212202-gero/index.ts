/**
 * 下呂市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.gero.lg.jp/site/gikai/list69.html
 * 自治体コード: 212202
 *
 * 下呂市は市役所公式サイト内で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズ: 年度別一覧 → 会議詳細ページ → PDF リンク を巡回し、
 *   各 PDF を 1 ListRecord として返す。
 * detail フェーズ: PDF をダウンロード・テキスト抽出し、発言をパースする。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { collectPdfEntries, parseStatements } from "./detail";
import { fetchMeetingList } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";
import { extractText, getDocumentProxy } from "../../../utils/pdf";

export const adapter: ScraperAdapter = {
  name: "212202",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);
    const records: ListRecord[] = [];

    for (let i = 0; i < meetings.length; i++) {
      const meeting = meetings[i]!;
      // 各会議詳細ページから PDF リンクを収集
      const pdfEntries = await collectPdfEntries(meeting.detailUrl);

      for (const entry of pdfEntries) {
        records.push({
          detailParams: {
            pdfUrl: entry.pdfUrl,
            title: meeting.title,
            section: meeting.section,
            linkText: entry.linkText,
            heldOn: entry.heldOn,
          },
        });
      }

      if (i < meetings.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return records;
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      section: string;
      linkText: string;
      heldOn: string;
    };

    // PDF をダウンロード・テキスト抽出
    let text: string | null = null;
    try {
      const buffer = await fetchBinary(params.pdfUrl);
      if (!buffer) return null;

      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
    } catch (err) {
      console.warn(
        `[212202-gero] PDF 取得失敗: ${params.pdfUrl}`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }

    if (!text) return null;

    const statements = parseStatements(text);
    if (statements.length === 0) return null;

    const attachmentMatch = params.pdfUrl.match(/\/(\d+)\.pdf$/i);
    const attachmentId = attachmentMatch ? attachmentMatch[1]! : null;
    const externalId = attachmentId ? `gero_${attachmentId}` : null;

    // タイトルを構築: 会議タイトル + PDF リンクテキスト（メタ情報を除去）
    const cleanLinkText = params.linkText
      .replace(/\[.*$/, "")
      .replace(/（.*$/, "")
      .trim();
    const title = `${params.title} ${cleanLinkText}`;

    return {
      municipalityCode,
      title,
      meetingType: detectMeetingType(params.title, params.section),
      heldOn: params.heldOn,
      sourceUrl: params.pdfUrl,
      externalId,
      statements,
    };
  },
};
