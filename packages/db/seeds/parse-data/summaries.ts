import type { MeetingTopicDigest } from "../../src/schema/meetings";

/** apps/meeting-summarizer 出力の summaries.ndjson 1 行に対応 */
export type SummaryNdjsonRow = {
  meetingId: string;
  municipalityCode: string;
  heldOn: string;
  summary: string;
  topicDigests: MeetingTopicDigest[];
  summaryModel: string;
  summaryGeneratedAt: string;
};

export function parseSummaryNdjsonLine(line: string): SummaryNdjsonRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as SummaryNdjsonRow;
}
