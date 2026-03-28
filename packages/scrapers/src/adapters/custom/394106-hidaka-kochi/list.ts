/**
 * 日高村議会 議会だより — list フェーズ
 *
 * 現行ページと過去ページから議会だより PDF を収集する。
 */

import {
  ARCHIVE_PAGE_URL,
  CURRENT_PAGE_URL,
  cleanText,
  fetchPage,
  parseEraDate,
  resolveUrl,
} from "./shared";

export interface HidakaKochiIssue {
  pdfUrl: string;
  title: string;
  heldOn: string;
  issueNumber: number;
}

export function parseIssueNumber(text: string): number | null {
  const match = cleanText(text).match(/第\s*(\d+)\s*号/);
  if (!match) return null;
  return Number(match[1]);
}

export function parseListPage(html: string): HidakaKochiIssue[] {
  const results: HidakaKochiIssue[] = [];
  const seen = new Set<string>();
  const pattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>([\s\S]{0,80}?)(?=<a|<\/(?:div|pre|p|span)|<br|$)/gi;

  for (const match of html.matchAll(pattern)) {
    const pdfUrl = resolveUrl(match[1]!);
    if (seen.has(pdfUrl)) continue;

    const context = cleanText(`${match[2] ?? ""} ${match[3] ?? ""}`);
    if (!context.includes("議会だより")) continue;

    const issueNumber = parseIssueNumber(context);
    const heldOn = parseEraDate(context);
    if (!issueNumber || !heldOn) continue;

    seen.add(pdfUrl);
    results.push({
      pdfUrl,
      title: `日高村議会だより 第${issueNumber}号`,
      heldOn,
      issueNumber,
    });
  }

  return results;
}

export async function fetchMeetingList(year: number): Promise<HidakaKochiIssue[]> {
  const [currentHtml, archiveHtml] = await Promise.all([
    fetchPage(CURRENT_PAGE_URL),
    fetchPage(ARCHIVE_PAGE_URL),
  ]);

  const merged = [
    ...(currentHtml ? parseListPage(currentHtml) : []),
    ...(archiveHtml ? parseListPage(archiveHtml) : []),
  ];

  const seen = new Set<string>();
  return merged.filter((issue) => {
    if (!issue.heldOn.startsWith(`${year}-`)) return false;
    if (seen.has(issue.pdfUrl)) return false;
    seen.add(issue.pdfUrl);
    return true;
  });
}
