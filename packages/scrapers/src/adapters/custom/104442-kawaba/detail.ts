/**
 * 川場村議会 会議録 -- detail フェーズ
 *
 * PDF からテキストを抽出し、○ マーカー付き発言を ParsedStatement に変換する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KawabaMeeting } from "./list";
import {
  collapseWhitespace,
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
  toHalfWidth,
} from "./shared";

const ROLE_SUFFIXES = [
  "議会運営委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
  "副教育長",
  "教育長",
  "教育委員会事務局長",
  "事務局長",
  "会計管理者",
  "課長補佐",
  "副課長",
  "課長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

const ANSWER_ROLE_SUFFIXES = [
  "村長",
  "副村長",
  "副教育長",
  "教育長",
  "教育委員会事務局長",
  "事務局長",
  "会計管理者",
  "課長補佐",
  "副課長",
  "課長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
];

function normalizeContent(text: string): string {
  return collapseWhitespace(text.replace(/[－-]\s*\d+\s*[－-]/g, " "));
}

function trimMarker(text: string): string {
  return text.replace(/^[○◯〇]\s*/, "");
}

function looksLikeSpeakerBlock(text: string): boolean {
  const normalized = normalizeContent(text);
  if (!/^[○◯〇]/.test(normalized)) return false;
  return /^[○◯〇]\s*.+?[（(].+?(?:君|様|議員)[）)]/.test(normalized);
}

export function extractMeetingTitleFromText(text: string): string | null {
  const head = normalizeContent(text.slice(0, 300)).replace(/^[－-]\s*\d+\s*[－-]\s*/, "");
  const match = head.match(/^(.*?)\s+令和\d+年\d+月\d+日/);
  return match ? match[1]!.trim() : null;
}

export function parseHeldOnFromText(text: string): string | null {
  const normalized = normalizeContent(text).replace(/\s+/g, "");
  const match = normalized.match(/令和(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const eraYear = match[1] === "元" ? 1 : Number(match[1]);
  const year = 2018 + eraYear;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = trimMarker(text);
  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = normalizeContent(match[1] ?? "");
    const rawName = (match[2] ?? "").replace(/[\s　]+/g, "").trim();
    const content = normalizeContent(match[3] ?? "");

    if (/^\d+番$/.test(toHalfWidth(rolePart))) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return {
      speakerName: rawName || null,
      speakerRole: rolePart || null,
      content,
    };
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: normalizeContent(stripped),
  };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole.endsWith("委員長")
  ) {
    return "remark";
  }
  if (ANSWER_ROLE_SUFFIXES.some((suffix) => speakerRole === suffix || speakerRole.endsWith(suffix))) {
    return "answer";
  }
  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯〇])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    if (!looksLikeSpeakerBlock(block)) continue;

    const normalized = normalizeContent(block);
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
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

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    console.warn(
      `[104442-kawaba] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: KawabaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOnFromText(text) ?? meeting.heldOnHint;
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const title = extractMeetingTitleFromText(text) ?? meeting.title;
  const externalIdKey = extractExternalIdKey(meeting.pdfUrl);

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: externalIdKey ? `kawaba_${externalIdKey}` : null,
    statements,
  };
}
