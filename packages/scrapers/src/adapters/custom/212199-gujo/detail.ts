/**
 * 郡上市議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーの発言単位へ分割する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { deSpacePdfText, fetchBinary, normalizeFullWidth } from "./shared";

export interface GujoDetailParams {
  title: string;
  sessionTitle: string;
  pdfUrl: string;
  heldOn: string;
  meetingType: "plenary" | "committee" | "extraordinary";
}

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "副教育長",
  "教育長",
  "議会事務局長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
] as const;

const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "議会事務局長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

const SPEAKER_RE =
  /[○◯◎●]\s*(?:副委員長|委員長|副議長|議長|副市長|市長|副教育長|教育長|議会事務局長|事務局長|局長|副部長|部長|副課長|課長|室長|係長|参事|主幹|主査|補佐|議員|委員|[\d０-９]+番|[^\s（(]{1,30})[（(][^（(）)]{1,30}(?:君|様|議員)?[）)]/g;

function cleanExtractedText(text: string): string {
  return deSpacePdfText(normalizeFullWidth(text))
    .replace(/－\d+－/g, " ")
    .replace(/[─-]{10,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)?[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = normalizeFullWidth(match[1]!).replace(/\s+/g, "").trim();
    const rawName = normalizeFullWidth(match[2]!).replace(/\s+/g, "").trim();
    const content = match[3]!.trim();

    if (/^[\d]+番$/.test(rolePart)) {
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

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
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

export function parseStatements(rawText: string): ParsedStatement[] {
  const normalized = cleanExtractedText(rawText);

  const speakerMatches: { index: number }[] = [];
  for (const match of normalized.matchAll(new RegExp(SPEAKER_RE.source, "g"))) {
    if (match.index !== undefined) {
      speakerMatches.push({ index: match.index });
    }
  }

  if (speakerMatches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < speakerMatches.length; i++) {
    const current = speakerMatches[i]!;
    const nextIndex =
      i + 1 < speakerMatches.length ? speakerMatches[i + 1]!.index : normalized.length;
    const block = normalized.slice(current.index, nextIndex).trim();
    if (!block) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(block);
    const cleanedContent = content.replace(/\s+◎[^\s○◯◎●][\s\S]*$/, "").trim();
    if (!cleanedContent) continue;
    if (/^(?:（[^）]*(?:登壇|退席|退場|着席)[^）]*）)?$/.test(cleanedContent)) continue;

    const contentHash = createHash("sha256").update(cleanedContent).digest("hex");
    const startOffset = offset;
    const endOffset = offset + cleanedContent.length;
    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: cleanedContent,
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
      `[212199-gujo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchMeetingData(
  params: GujoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const filename =
    new URL(params.pdfUrl).pathname
      .split("/")
      .pop()
      ?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `gujo_${filename}` : null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
