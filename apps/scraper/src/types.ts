export interface MeetingData {
  title: string;
  meetingType: string;
  heldOn: string; // YYYY-MM-DD
  sourceUrl: string | null;
  assemblyLevel: "national" | "prefectural" | "municipal";
  prefecture: string | null;
  municipality: string | null;
  externalId: string | null;
  rawText: string;
}
