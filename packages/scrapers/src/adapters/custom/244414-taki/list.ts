/**
 * 多気町議会 -- list フェーズ
 *
 * 一般質問会議録インデックスページから年度別ページ URL を取得し、
 * 指定年の PDF リンクを収集する。
 *
 * 手順:
 *   1. kaigiroku/index.html から年度別ページ URL を取得
 *   2. 指定年の年度別ページから PDF リンクを抽出
 */

import type { ListRecord } from "../../adapter";
import {
  KAIGIROKU_INDEX_URL,
  detectMeetingType,
  extractYearLinks,
  extractPdfLinks,
  extractSessionNumber,
  fetchPage,
  delay,
} from "./shared";

export interface TakiPdfRecord {
  /** 会議タイトル（リンクテキスト） */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 対象年（西暦） */
  year: number;
  /** 回数 */
  sessionNumber: number | null;
  /** 年度別ページ URL（externalId 生成に使用） */
  yearPageUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfList(_baseUrl: string, year: number): Promise<TakiPdfRecord[]> {
  const allRecords: TakiPdfRecord[] = [];

  await delay(INTER_PAGE_DELAY_MS);
  const indexHtml = await fetchPage(KAIGIROKU_INDEX_URL);
  if (!indexHtml) return allRecords;

  const yearLinks = extractYearLinks(indexHtml);
  const yearEntry = yearLinks.find((e) => e.year === year);
  if (!yearEntry) return allRecords;

  await delay(INTER_PAGE_DELAY_MS);
  const yearPageHtml = await fetchPage(yearEntry.url);
  if (!yearPageHtml) return allRecords;

  const pdfLinks = extractPdfLinks(yearPageHtml, yearEntry.url);

  for (const { title, pdfUrl } of pdfLinks) {
    const meetingType = detectMeetingType(title);
    const sessionNumber = extractSessionNumber(title);
    allRecords.push({
      title,
      meetingType,
      pdfUrl,
      year,
      sessionNumber,
      yearPageUrl: yearEntry.url,
    });
  }

  return allRecords;
}

/**
 * TakiPdfRecord を ListRecord に変換する。
 * テスト用に export する。
 */
export function toListRecord(record: TakiPdfRecord): ListRecord {
  return {
    detailParams: {
      title: record.title,
      meetingType: record.meetingType,
      pdfUrl: record.pdfUrl,
      year: record.year,
      sessionNumber: record.sessionNumber,
      yearPageUrl: record.yearPageUrl,
    },
  };
}
