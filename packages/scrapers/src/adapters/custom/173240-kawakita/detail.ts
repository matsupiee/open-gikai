/**
 * 川北町議会 会議録 -- detail フェーズ
 *
 * PDF からテキストを抽出し、◇マーカー付き発言を ParsedStatement に変換する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KawakitaMeeting } from "./list";
import {
  collapseWhitespace,
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
  parseJapaneseDate,
  toHalfWidth,
} from "./shared";

const ROLE_PREFIXES = [
  "総務産業常任委員会委員長",
  "文教厚生常任委員会委員長",
  "予算決算特別委員会委員長",
  "議会広報委員長",
  "委員長",
  "副委員長",
  "議長",
  "副議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "教育次長",
  "会計管理者",
  "課長補佐",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
];

const ANSWER_ROLE_PREFIXES = new Set([
  "町長",
  "副町長",
  "副教育長",
  "教育長",
  "教育次長",
  "会計管理者",
  "課長補佐",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

function normalizeContent(text: string): string {
  return collapseWhitespace(
    text
      .replace(/[－-]\s*\d+\s*[－-]/g, " ")
      .replace(/〔[^〕]*〕/g, " "),
  ).replace(/([。、「」])\s+/g, "$1");
}

function isNameToken(token: string): boolean {
  const normalized = token.replace(/君$/, "");
  return /^[一-龥々ぁ-ゖァ-ヺー]+$/.test(normalized) && normalized.length <= 4;
}

function splitNameAndContent(text: string): {
  speakerName: string | null;
  content: string;
} {
  const tokens = normalizeContent(text).split(" ").filter(Boolean);
  if (tokens.length === 0) return { speakerName: null, content: "" };

  const nameTokens: string[] = [];
  if (isNameToken(tokens[0]!)) {
    nameTokens.push(tokens.shift()!.replace(/君$/, ""));
    if (
      nameTokens[0]!.length <= 2 &&
      tokens[0] &&
      isNameToken(tokens[0]!) &&
      tokens[0]!.replace(/君$/, "").length <= 3
    ) {
      nameTokens.push(tokens.shift()!.replace(/君$/, ""));
    }
  }

  return {
    speakerName: nameTokens.length > 0 ? nameTokens.join("") : null,
    content: tokens.join(" ").trim(),
  };
}

export function parseHeldOnFromText(text: string): string | null {
  return parseJapaneseDate(text);
}

export function extractMeetingTitleFromText(text: string): string | null {
  const normalized = collapseWhitespace(text).replace(/\s+/g, "");
  const match = normalized.match(/令和\d+年第\d+回川北町議会(?:定例会|臨時会)/);
  return match ? match[0] ?? null : null;
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = normalizeContent(text.replace(/^[◇◆]\s*/, ""));
  const numberedMatch = toHalfWidth(stripped).match(/^(\d+)\s*番\s+([\s\S]*)$/);
  if (numberedMatch) {
    const { speakerName, content } = splitNameAndContent(numberedMatch[2] ?? "");
    return {
      speakerName,
      speakerRole: "議員",
      content,
    };
  }

  for (const role of ROLE_PREFIXES) {
    if (!stripped.startsWith(role)) continue;
    const { speakerName, content } = splitNameAndContent(stripped.slice(role.length).trim());
    return {
      speakerName,
      speakerRole: role,
      content,
    };
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: stripped,
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
  if (speakerRole === "議員") return "question";
  if (ANSWER_ROLE_PREFIXES.has(speakerRole)) return "answer";
  return "question";
}

function looksLikeSpeakerBlock(text: string): boolean {
  const normalized = normalizeContent(text);
  if (!/^[◇◆]/.test(normalized)) return false;
  if (ROLE_PREFIXES.some((role) => normalized.startsWith(`◇${role}`) || normalized.startsWith(`◆${role}`))) {
    return true;
  }
  return /^[◇◆]\s*[0-9０-９]+\s*番/.test(normalized);
}

export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[◇◆])/);
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
      `[173240-kawakita] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: KawakitaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const heldOn = meeting.heldOnHint ?? parseHeldOnFromText(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const title = extractMeetingTitleFromText(text)
    ? `${extractMeetingTitleFromText(text)} ${heldOn}`
    : meeting.title;
  const externalIdKey = extractExternalIdKey(meeting.pdfUrl);

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(meeting.sessionTitle),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: externalIdKey ? `kawakita_${externalIdKey}` : null,
    statements,
  };
}
