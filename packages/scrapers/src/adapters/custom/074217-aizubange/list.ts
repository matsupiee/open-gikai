/**
 * 会津坂下町議会 — list フェーズ
 *
 * 単一ページの表から PDF リンクを抽出する。
 * 年号・会期は rowspan で共有されているため、直前の値を引き継ぎながら読む。
 */

import { BASE_ORIGIN, fetchPage } from "./shared";

export interface AizubangeMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

function stripTags(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u200b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text: string): string {
  return normalizeDigits(stripTags(text)).replace(/\s+/g, " ").trim();
}

/**
 * 年号セルと日にちセルから開催日を YYYY-MM-DD に変換する。
 * e.g., ("令和7年", "3月6日（招集日）") → "2025-03-06"
 */
export function parseDateText(
  yearLabel: string,
  dayText: string,
): string | null {
  const normalizedYear = normalizeDigits(yearLabel).replace(/\s+/g, "");
  const yearMatch = normalizedYear.match(/(令和|平成)(元|\d+)年/);
  if (!yearMatch) return null;

  const eraYear = yearMatch[2] === "元" ? 1 : Number(yearMatch[2]);
  if (Number.isNaN(eraYear)) return null;

  let westernYear: number;
  if (yearMatch[1] === "令和") westernYear = eraYear + 2018;
  else westernYear = eraYear + 1988;

  const normalizedDay = normalizeDigits(dayText).replace(/\s+/g, "");
  const dayMatch = normalizedDay.match(/(\d+)月(\d+)日/);
  if (!dayMatch) return null;

  const month = Number(dayMatch[1]);
  const day = Number(dayMatch[2]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function resolvePdfUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }
  return new URL(href, baseUrl).toString();
}

/**
 * 一覧ページの HTML から PDF リンクと会議メタ情報を抽出する。
 *
 * HTML 構造:
 * - 年号列: `令和7年` など（rowspan）
 * - 会期列: `第1回定例会` など（rowspan）
 * - 日にち列: `3月6日（招集日）`
 * - 会議録内容列: PDF リンク
 */
export function parseListPage(
  html: string,
  baseUrl: string,
  targetYear?: number,
): AizubangeMeeting[] {
  const results: AizubangeMeeting[] = [];
  let currentYearLabel: string | null = null;
  let currentSession = "";

  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellPattern = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[1]!;
    const cells = [...rowHtml.matchAll(cellPattern)].map((match) => ({
      html: match[1]!,
      text: normalizeText(match[1]!),
    }));

    if (cells.length === 0) continue;

    const linkMatch = rowHtml.match(
      /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkMatch) continue;

    const pdfCellIndex = cells.findIndex((cell) => /\.pdf/i.test(cell.html));
    if (pdfCellIndex <= 0) continue;

    for (const cell of cells.slice(0, pdfCellIndex)) {
      if (/(令和|平成)/.test(cell.text)) {
        currentYearLabel = cell.text;
      }
      if (/(定例会|臨時会|委員会)/.test(cell.text)) {
        currentSession = cell.text;
      }
    }

    if (!currentYearLabel || !currentSession) continue;

    const dateText = cells[pdfCellIndex - 1]!.text;
    const heldOn = parseDateText(currentYearLabel, dateText);
    if (!heldOn) continue;

    if (targetYear !== undefined && Number(heldOn.slice(0, 4)) !== targetYear) {
      continue;
    }

    const pdfUrl = resolvePdfUrl(linkMatch[1]!, baseUrl);

    results.push({
      pdfUrl,
      title: `${currentSession} ${dateText}`,
      heldOn,
      sessionName: currentSession,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<AizubangeMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, baseUrl, year);
}
