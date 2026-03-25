/** local-bulk-scraper 出力の meetings.ndjson 1 行に対応 */
export type MeetingNdjsonRow = {
  id: string;
  /** 団体コード（municipalities.code） */
  municipalityCode: string;
  title: string;
  meetingType: string;
  heldOn: string;
  sourceUrl: string | null;
  externalId: string | null;
  status: string;
  scrapedAt: string | null;
};

export function parseMeetingNdjsonLine(line: string): MeetingNdjsonRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as MeetingNdjsonRow;
}
