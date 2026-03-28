/**
 * 東通村議会 — list フェーズ
 *
 * 「議会開催状況 - 定例会及び臨時会の記録」ページのテーブルから、
 * 定例会・臨時会の一覧を抽出する。
 */

import {
  MEETING_LIST_URL,
  fetchPage,
  normalizeText,
  parseJapaneseDate,
} from "./shared";

export interface HigashidooriMeeting {
  title: string;
  heldOn: string;
}

function parseMeetingRow(rowHtml: string): HigashidooriMeeting | null {
  const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
  if (cells.length < 2) return null;

  const title = normalizeText(cells[0]![1]!.replace(/<[^>]+>/g, ""));
  const heldOnText = normalizeText(cells[1]![1]!.replace(/<[^>]+>/g, ""));

  if (!title || !heldOnText) return null;
  if (!title.includes("定例会") && !title.includes("臨時会")) return null;

  const heldOn = parseJapaneseDate(heldOnText);
  if (!heldOn) return null;

  return { title, heldOn };
}

export function parseListPage(html: string): HigashidooriMeeting[] {
  const tableMatch = html.match(
    /<table[^>]*summary="これまでの定例会・臨時会開催期間"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch?.[1]) return [];

  const meetings: HigashidooriMeeting[] = [];

  for (const rowMatch of tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const meeting = parseMeetingRow(rowMatch[1]!);
    if (!meeting) continue;

    if (
      meetings.some(
        (existing) =>
          existing.title === meeting.title && existing.heldOn === meeting.heldOn,
      )
    ) {
      continue;
    }

    meetings.push(meeting);
  }

  return meetings;
}

export async function fetchMeetingList(
  year: number,
): Promise<HigashidooriMeeting[]> {
  const html = await fetchPage(MEETING_LIST_URL);
  if (!html) return [];

  return parseListPage(html).filter(
    (meeting) => Number(meeting.heldOn.slice(0, 4)) === year,
  );
}

