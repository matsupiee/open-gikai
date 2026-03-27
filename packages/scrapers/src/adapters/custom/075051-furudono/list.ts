/**
 * 古殿町議会 — list フェーズ
 *
 * 一覧ページは「会期見出しの段落」と「PDF リンク群の段落」が交互に並ぶ。
 */

import {
  BASE_ORIGIN,
  fetchPage,
  parseWarekiDate,
  parseWarekiYear,
  toHalfWidth,
} from "./shared";

export interface FurudonoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

function stripTags(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#12288;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text: string): string {
  return toHalfWidth(stripTags(text));
}

function looksLikeSessionHeading(text: string): boolean {
  return (
    /(?:令和|平成)/.test(text) &&
    /(?:定例会|臨時会|委員会)/.test(text)
  );
}

export function parseHeldOn(
  sessionName: string,
  entryLabel: string,
): string | null {
  const direct = parseWarekiDate(`${sessionName} ${entryLabel}`);
  if (direct) return direct;

  const year = parseWarekiYear(sessionName);
  if (!year) return null;

  const normalizedLabel = toHalfWidth(entryLabel).replace(/\s+/g, "");
  const dateMatch = normalizedLabel.match(/(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
 * 一覧ページの HTML から PDF 会議録を抽出する。
 */
export function parseListPage(
  html: string,
  baseUrl: string,
  targetYear?: number,
): FurudonoMeeting[] {
  const results: FurudonoMeeting[] = [];
  const sanitizedHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  const paragraphPattern =
    /<div[^>]*class="[^"]*\bparagraph\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;

  let currentSessionName: string | null = null;

  for (const match of sanitizedHtml.matchAll(paragraphPattern)) {
    const blockHtml = match[1]!;
    const blockText = normalizeText(blockHtml);
    if (!blockText) continue;

    const links = [...blockHtml.matchAll(linkPattern)];
    if (links.length === 0) {
      if (looksLikeSessionHeading(blockText)) {
        currentSessionName = blockText;
      }
      continue;
    }

    if (!currentSessionName) continue;

    for (const linkMatch of links) {
      const href = linkMatch[1]!;
      const label = normalizeText(linkMatch[2] || linkMatch[3] || "");
      if (!label) continue;

      const heldOn = parseHeldOn(currentSessionName, label);
      if (!heldOn) continue;
      if (targetYear !== undefined && Number(heldOn.slice(0, 4)) !== targetYear) {
        continue;
      }

      results.push({
        pdfUrl: resolvePdfUrl(href, baseUrl),
        title: `${currentSessionName} ${label}`,
        heldOn,
        sessionName: currentSessionName,
      });
    }
  }

  return results;
}

export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<FurudonoMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, baseUrl, year);
}
