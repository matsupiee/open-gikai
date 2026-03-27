/**
 * 笛吹市議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、〇マーカー付きの発言を
 * ParsedStatement 配列に変換する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FuefukiMeeting } from "./list";
import { collapseForMatching, fetchBinary } from "./shared";

const ROLE_SUFFIXES = [
  "議会事務局長",
  "副委員長",
  "委員長",
  "副議長",
  "副市長",
  "副教育長",
  "教育長",
  "事務局長",
  "議長",
  "市長",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "議会事務局長",
  "事務局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
]);

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30));
}

function looksLikeSpeakerBlock(text: string): boolean {
  return /^[〇○◯◎●]\s*.+?[（(].+?(?:君|様|議員)[）)]/.test(text);
}

function buildIsoDate(
  era: string,
  eraYearText: string,
  monthText: string,
  dayText: string,
): string {
  const eraYear = eraYearText === "元" ? 1 : Number(eraYearText);
  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  return `${year}-${monthText.padStart(2, "0")}-${dayText.padStart(2, "0")}`;
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[〇○◯◎●]\s*/, "");
  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();
    const normalizedRole = rolePart.replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
    );

    if (/^\d+番$/.test(normalizedRole)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizeText(text);
  const blocks = normalized.split(/(?=[〇○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !looksLikeSpeakerBlock(trimmed)) continue;

    const cleaned = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(cleaned);
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

export function parseHeldOnFromText(text: string): string | null {
  const collapsed = collapseForMatching(text);

  const openMatch = collapsed.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日開会/);
  if (openMatch) {
    return buildIsoDate(openMatch[1]!, openMatch[2]!, openMatch[3]!, openMatch[4]!);
  }

  const fallbackMatch = collapsed.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!fallbackMatch) return null;

  return buildIsoDate(
    fallbackMatch[1]!,
    fallbackMatch[2]!,
    fallbackMatch[3]!,
    fallbackMatch[4]!,
  );
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[192112-fuefuki] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: FuefukiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = parseHeldOnFromText(text);
  if (!heldOn) return null;

  const fileName = new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  if (!fileName) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: `fuefuki_${fileName}`,
    statements,
  };
}
