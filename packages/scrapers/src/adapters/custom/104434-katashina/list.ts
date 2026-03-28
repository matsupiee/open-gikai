/**
 * 片品村議会（群馬県） — list フェーズ
 *
 * 単一の会議録ページ内の表から、会期名・開催日・PDF URL を抽出する。
 * 会期名は rowspan で省略されるため、直前の値を引き継ぐ。
 */

import {
  LIST_PAGE_URL,
  collapseWhitespace,
  detectMeetingType,
  fetchPage,
  parseWarekiDate,
  parseWarekiYear,
  resolveUrl,
} from "./shared";

export interface KatashinaMeeting {
  pdfUrl: string;
  title: string;
  sessionTitle: string;
  meetingType: "plenary" | "committee" | "extraordinary";
  heldOnHint: string | null;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

function cleanCellText(text: string): string {
  return collapseWhitespace(stripHtml(text));
}

export function parseHeldOnHint(linkText: string): string | null {
  return parseWarekiDate(linkText);
}

export function parseTableRows(html: string): KatashinaMeeting[] {
  const meetings: KatashinaMeeting[] = [];
  let currentSessionTitle: string | null = null;

  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const rowHtml = rowMatch[1] ?? "";
    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (match) => match[1] ?? "",
    );
    if (cells.length < 2) continue;

    const firstCellText = cleanCellText(cells[0] ?? "");
    if (firstCellText === "会議名称") continue;

    if (cells.length >= 3 && firstCellText) {
      currentSessionTitle = firstCellText;
    }

    if (!currentSessionTitle) continue;

    const linkCellHtml = cells[cells.length - 2] ?? "";
    const linkMatch = linkCellHtml.match(/<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch?.[1] || !linkMatch[2]) continue;

    const linkText = cleanCellText(linkMatch[2]);
    if (!linkText) continue;

    meetings.push({
      pdfUrl: resolveUrl(linkMatch[1]),
      title: `${currentSessionTitle} ${linkText}`,
      sessionTitle: currentSessionTitle,
      meetingType: detectMeetingType(currentSessionTitle),
      heldOnHint: parseHeldOnHint(linkText),
    });
  }

  return meetings;
}

export function parseListPage(html: string, year: number): KatashinaMeeting[] {
  return parseTableRows(html).filter(
    (meeting) => parseWarekiYear(meeting.sessionTitle) === year,
  );
}

export async function fetchMeetingList(year: number): Promise<KatashinaMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
