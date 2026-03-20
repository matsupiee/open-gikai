/**
 * rawText から解析された1発言分のデータ。
 * 各 system type の scraper が生成する。
 */
export interface ParsedStatement {
  kind: string;
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
  contentHash: string;
  startOffset: number;
  endOffset: number;
}

export interface MeetingData {
  municipalityId: string;
  title: string;
  meetingType: string;
  heldOn: string; // YYYY-MM-DD
  sourceUrl: string | null;
  externalId: string | null;
  statements: ParsedStatement[];
}
