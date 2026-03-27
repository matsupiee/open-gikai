/**
 * 古殿町議会 — detail フェーズ
 *
 * PDF をテキスト抽出し、`○議長（氏名君）` / `○４番（氏名君）` 形式を中心に
 * 発言ブロックへ分割する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FurudonoMeeting } from "./list";
import {
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
  toHalfWidth,
} from "./shared";

const ROLE_SUFFIXES = [
  "健康管理センター所長",
  "代表監査委員",
  "会計管理者",
  "副委員長",
  "事務局長",
  "副議長",
  "副町長",
  "副教育長",
  "教育次長",
  "委員長",
  "教育長",
  "監査委員",
  "議長",
  "町長",
  "部長",
  "次長",
  "課長",
  "館長",
  "所長",
  "局長",
  "主幹",
  "議員",
  "委員",
] as const;

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "教育次長",
  "会計管理者",
  "代表監査委員",
  "監査委員",
  "事務局長",
  "部長",
  "次長",
  "課長",
  "館長",
  "所長",
  "局長",
  "主幹",
]);

function normalizePdfText(text: string): string {
  return text
    .replace(/－\s*\d+\s*－/g, " ")
    .replace(/-+\s*\d+\s*-+/g, " ")
    .replace(/─+/g, "\n")
    .replace(/\f/g, "\n");
}

function cleanStageDirections(content: string): string {
  return content
    .replace(/[〔\[](?:[^[\]〔〕]*(?:登壇|退席|退場|着席)[^[\]〔〕]*)[〕\]]/g, " ")
    .replace(
      /^(?:[〔\[](?:[^[\]〔〕]*(?:登壇|退席|退場|着席)[^[\]〔〕]*)[〕\]]\s*)+/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");

  const bracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)?[）)]\s*([\s\S]*)/,
  );
  if (bracketMatch) {
    const rolePart = toHalfWidth(bracketMatch[1]!).replace(/[\s　]+/g, "").trim();
    const speakerName = bracketMatch[2]!.replace(/[\s　]+/g, "").trim() || null;
    const content = cleanStageDirections(bracketMatch[3]!.trim());

    if (/^\d+番$/.test(rolePart)) {
      return { speakerName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName, speakerRole: suffix, content };
      }
    }

    return { speakerName, speakerRole: rolePart || null, content };
  }

  const inlineMatch = stripped.match(/^(\S+)\s+(\S+?)\s+([\s\S]*)$/);
  if (inlineMatch) {
    const rolePart = toHalfWidth(inlineMatch[1]!).replace(/[\s　]+/g, "");
    const speakerName = inlineMatch[2]!.replace(/[\s　]+/g, "") || null;
    const content = cleanStageDirections(inlineMatch[3]!.trim());

    if (/^\d+番$/.test(rolePart)) {
      return { speakerName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  ) {
    return "remark";
  }
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

function shouldSkipContent(content: string): boolean {
  return /^(開議の宣告|一般質問|会議録署名議員の指名)$/.test(content);
}

export function parseStatements(text: string): ParsedStatement[] {
  const blocks = normalizePdfText(text).split(/(?=[○◯〇◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇◎●]/.test(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!speakerName && !speakerRole) continue;
    if (!content || shouldSkipContent(content)) continue;

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
  } catch (err) {
    console.warn(
      `[075051-furudono] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: FurudonoMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const normalizedText = normalizePdfText(text);
  if (normalizedText.replace(/[\s\d/第日－-]+/g, "").length < 20) {
    console.warn(
      `[075051-furudono] PDF text appears empty or image-based: ${meeting.pdfUrl}`,
    );
    return null;
  }

  const statements = parseStatements(normalizedText);
  if (statements.length === 0) {
    console.warn(`[075051-furudono] no statements extracted: ${meeting.pdfUrl}`);
    return null;
  }

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `furudono_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.sessionName),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
