/**
 * 玉城町議会 -- list フェーズ
 *
 * 手順:
 *   1. 索引ページから年度別目次 URL を収集する
 *   2. 指定年に対応する年度別目次から PDF リンクを抽出する
 *
 * 年度と目次ページの対応は、目次ページの HTML 内に含まれる和暦テキストから判別する。
 * 令和5年以降は URL にタイムスタンプが含まれるため URL から年度を推測せず、
 * 索引ページのリンクテキストまたは目次ページ内のテキストを参照する。
 */

import type { ListRecord } from "../../adapter";
import {
  INDEX_URL,
  BASE_URL,
  detectMeetingType,
  extractYearlyTocLinks,
  extractPdfLinks,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface TamakiPdfRecord {
  /** 会議タイトル（PDF リンクテキスト） */
  title: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 対象年 */
  year: number;
  /** 年度別目次ページ URL */
  tocPageUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 年度別目次ページの HTML からその年度の西暦を推測する。
 * `<h1>`, `<h2>`, `<title>` などに含まれる和暦テキストから判別する。
 */
function detectYearFromHtml(html: string): number | null {
  // 和暦パターンを探す
  const patterns = [
    /令和(\d+|元)年/,
    /平成(\d+|元)年/,
    /昭和(\d+|元)年/,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[0]) {
      const year = parseWarekiYear(m[0]);
      if (year) return year;
    }
  }

  return null;
}

/**
 * 索引ページのリンクテキストから年度を取得する。
 * `<a href="...">令和6年度 議事録</a>` のようなテキストから。
 */
function extractYearFromLinkText(html: string, targetUrl: string): number | null {
  // ターゲット URL へのリンクタグを探し、そのテキストから年を取得
  const escapedUrl = targetUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // href が targetUrl を含む a タグを探す（相対パスも考慮）
  const relPath = targetUrl.replace(BASE_URL, "");
  const escapedRel = relPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    new RegExp(`href="${escapedUrl}"[^>]*>([^<]+)<`, "i"),
    new RegExp(`href="${escapedRel}"[^>]*>([^<]+)<`, "i"),
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) {
      const year = parseWarekiYear(m[1]);
      if (year) return year;
    }
  }

  return null;
}

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<TamakiPdfRecord[]> {
  const allRecords: TamakiPdfRecord[] = [];

  // Step 1: 索引ページから年度別目次 URL を収集
  await delay(INTER_PAGE_DELAY_MS);
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const tocLinks = extractYearlyTocLinks(indexHtml);
  if (tocLinks.length === 0) return [];

  // Step 2: 各年度別目次ページを確認し、指定年のものから PDF を収集
  for (const { url: tocUrl } of tocLinks) {
    // まず索引ページのリンクテキストから年度を確認
    const yearFromLinkText = extractYearFromLinkText(indexHtml, tocUrl);

    // リンクテキストから年が特定できた場合、対象年と一致するか確認
    if (yearFromLinkText !== null && yearFromLinkText !== year) {
      continue;
    }

    await delay(INTER_PAGE_DELAY_MS);
    const tocHtml = await fetchPage(tocUrl);
    if (!tocHtml) continue;

    // 目次ページの HTML から年度を確認（リンクテキストで特定できなかった場合も含む）
    const yearFromHtml = detectYearFromHtml(tocHtml);
    const detectedYear = yearFromLinkText ?? yearFromHtml;

    if (detectedYear !== null && detectedYear !== year) {
      continue;
    }

    // PDF リンクを抽出
    const pdfLinks = extractPdfLinks(tocHtml, tocUrl);

    for (const { title, pdfUrl } of pdfLinks) {
      const meetingType = detectMeetingType(title);
      allRecords.push({
        title,
        meetingType,
        pdfUrl,
        year,
        tocPageUrl: tocUrl,
      });
    }
  }

  return allRecords;
}

/**
 * TamakiPdfRecord を ListRecord に変換する。
 */
export function toListRecord(record: TamakiPdfRecord): ListRecord {
  return {
    detailParams: {
      title: record.title,
      meetingType: record.meetingType,
      pdfUrl: record.pdfUrl,
      year: record.year,
      tocPageUrl: record.tocPageUrl,
    },
  };
}
