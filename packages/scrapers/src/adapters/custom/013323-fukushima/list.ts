import {
  BASE_ORIGIN,
  TARGET_KIND_IDS,
  buildListUrl,
  decodeHtmlEntities,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface FukushimaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: string;
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse meeting dates embedded in titles such as:
 * - 定例会３月会議（１日目）(2026.3.10)
 * - 定例会7月会議(R7.7.18)
 * - 令和元年度定例会３月会議（１日目）(2020.03.09)
 */
export function parseHeldOnFromTitle(title: string): string | null {
  const normalized = toHalfWidth(title);

  const western = normalized.match(/\((20\d{2})\.(\d{1,2})\.(\d{1,2})\)/);
  if (western) {
    const year = Number(western[1]);
    const month = Number(western[2]);
    const day = Number(western[3]);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const abbreviated = normalized.match(/\(([RH])(\d{1,2})\.(\d{1,2})\.(\d{1,2})\)/i);
  if (abbreviated) {
    const era = abbreviated[1]!.toUpperCase();
    const eraYear = Number(abbreviated[2]);
    const month = Number(abbreviated[3]);
    const day = Number(abbreviated[4]);
    const westernYear = era === "R" ? eraYear + 2018 : eraYear + 1988;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * Parse one fiscal-year conference materials page.
 *
 * The target content is structured as repeated blocks:
 *   <p>meeting title (date)</p>
 *   <table class="council">...</table>
 *   <td colspan="5"><a href="...pdf">議事録</a></td>
 *   <table class="other">...</table>
 */
export function parseConferenceMaterialPage(html: string): FukushimaMeeting[] {
  const contentMatch = html.match(
    /<div[^>]+id="conferenceMaterial-content"[^>]*>([\s\S]*?)<\/div>/i,
  );
  const content = contentMatch?.[1] ?? html;

  const titleMatches = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const meetings: FukushimaMeeting[] = [];

  for (let i = 0; i < titleMatches.length; i++) {
    const current = titleMatches[i]!;
    const nextIndex =
      i + 1 < titleMatches.length ? titleMatches[i + 1]!.index! : content.length;

    const rawTitle = stripTags(current[1]!);
    const heldOn = parseHeldOnFromTitle(rawTitle);
    if (!heldOn) continue;

    const blockStart = current.index! + current[0].length;
    const block = content.slice(blockStart, nextIndex);
    const pdfMatch = block.match(
      /<a[^>]+href="([^"]+\.pdf)"[^>]*>\s*議事録\s*<\/a>/i,
    );
    if (!pdfMatch) continue;

    const pdfUrl = new URL(decodeHtmlEntities(pdfMatch[1]!), BASE_ORIGIN).toString();
    meetings.push({
      pdfUrl,
      title: rawTitle,
      heldOn,
      meetingType: detectMeetingType(rawTitle),
    });
  }

  return meetings;
}

function dedupeMeetings(meetings: FukushimaMeeting[]): FukushimaMeeting[] {
  const deduped = new Map<string, FukushimaMeeting>();
  for (const meeting of meetings) {
    if (!deduped.has(meeting.pdfUrl)) {
      deduped.set(meeting.pdfUrl, meeting);
    }
  }
  return [...deduped.values()];
}

export async function fetchMeetingList(year: number): Promise<FukushimaMeeting[]> {
  const fiscalYears = year === 2019 ? [2019] : [year - 1, year];
  const meetings: FukushimaMeeting[] = [];

  for (const fiscalYear of fiscalYears) {
    for (const kindId of TARGET_KIND_IDS) {
      const html = await fetchPage(buildListUrl(fiscalYear, kindId));
      if (!html) continue;
      meetings.push(...parseConferenceMaterialPage(html));
    }
  }

  return dedupeMeetings(meetings).filter((meeting) =>
    meeting.heldOn.startsWith(`${year}-`),
  );
}
