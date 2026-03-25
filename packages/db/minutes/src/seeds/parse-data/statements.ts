/** local-bulk-scraper 出力の statements.ndjson 1 行に対応 */
export type StatementNdjsonRow = {
  id: string;
  meetingId: string;
  kind: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
  contentHash: string;
  startOffset: number | null;
  endOffset: number | null;
};

export function parseStatementNdjsonLine(line: string): StatementNdjsonRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as StatementNdjsonRow;
}
