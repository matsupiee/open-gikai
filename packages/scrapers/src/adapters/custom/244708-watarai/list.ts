/**
 * 度会町議会 -- list フェーズ
 *
 * カテゴリトップから年度別 frmId を取得し、指定年の PDF リンクを収集する。
 *
 * 手順:
 *   1. カテゴリトップ（category_list.php?frmCd=8-0-0-0-0）から frmId を全取得
 *   2. 各 frmId の年度別ページを取得して PDF リンクを抽出
 *   3. 指定年に該当するレコードのみ返す
 *
 * 年度は PDF タイトルまたはページタイトルの和暦から判定する。
 * 判定できない場合はすべての frmId を試行して PDF リンクのタイトルから判定する。
 */

import type { ListRecord } from "../../adapter";
import {
  CATEGORY_TOP_URL,
  buildYearPageUrl,
  detectMeetingType,
  extractFrmIds,
  extractPdfLinks,
  extractSessionNumber,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface WataraiPdfRecord {
  /** 会議タイトル（リンクテキストまたは推定値） */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 対象年（西暦） */
  year: number;
  /** 回数 */
  sessionNumber: number | null;
  /** frmId（年度別ページ識別子） */
  frmId: number;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 年度別ページのタイトルや見出しから年を取得する。
 */
function extractYearFromPageHtml(html: string): number | null {
  // ページ内のタイトルや見出しから年を検索
  const headingPattern = /<(?:h[1-6]|title)[^>]*>([^<]*(?:令和|平成)\d+年[^<]*)<\/(?:h[1-6]|title)>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingPattern.exec(html)) !== null) {
    const year = parseWarekiYear(m[1]!);
    if (year) return year;
  }

  // strong, p タグなども試みる
  const inlinePattern = /(?:令和|平成)(\d+|元)年/g;
  const firstMatch = inlinePattern.exec(html);
  if (firstMatch) {
    return parseWarekiYear(firstMatch[0]);
  }

  return null;
}

/**
 * PDF タイトルから年を推定する。
 */
function extractYearFromTitle(title: string): number | null {
  return parseWarekiYear(title);
}

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfList(_baseUrl: string, year: number): Promise<WataraiPdfRecord[]> {
  const allRecords: WataraiPdfRecord[] = [];

  await delay(INTER_PAGE_DELAY_MS);
  const topHtml = await fetchPage(CATEGORY_TOP_URL);
  if (!topHtml) return allRecords;

  const frmIds = extractFrmIds(topHtml);
  if (frmIds.length === 0) return allRecords;

  for (const frmId of frmIds) {
    await delay(INTER_PAGE_DELAY_MS);
    const yearPageUrl = buildYearPageUrl(frmId);
    const yearPageHtml = await fetchPage(yearPageUrl);
    if (!yearPageHtml) continue;

    // ページから年を取得して指定年と一致するか確認
    const pageYear = extractYearFromPageHtml(yearPageHtml);

    const pdfLinks = extractPdfLinks(yearPageHtml, yearPageUrl);
    if (pdfLinks.length === 0) continue;

    for (const { title, pdfUrl } of pdfLinks) {
      // タイトルから年を取得するか、ページの年を使う
      const recordYear = extractYearFromTitle(title) ?? pageYear;

      // 年が特定できない場合や対象年と異なる場合はスキップ
      if (!recordYear || recordYear !== year) continue;

      const meetingType = detectMeetingType(title);
      const sessionNumber = extractSessionNumber(title);

      allRecords.push({
        title,
        meetingType,
        pdfUrl,
        year,
        sessionNumber,
        frmId,
      });
    }

    // ページ年が特定できた場合、対象年より古い年度は以降スキップ
    if (pageYear && pageYear < year) break;
  }

  return allRecords;
}

/**
 * WataraiPdfRecord を ListRecord に変換する。
 */
export function toListRecord(record: WataraiPdfRecord): ListRecord {
  return {
    detailParams: {
      title: record.title,
      meetingType: record.meetingType,
      pdfUrl: record.pdfUrl,
      year: record.year,
      sessionNumber: record.sessionNumber,
      frmId: record.frmId,
    },
  };
}
