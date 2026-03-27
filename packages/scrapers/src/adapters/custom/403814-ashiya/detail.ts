/**
 * 芦屋町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractAttachmentId, fetchBinary, parseJapaneseDate, toHalfWidthDigits } from "./shared";

export interface AshiyaDetailParams {
  title: string;
  pdfUrl: string;
  heldOn: string | null;
  meetingType: string;
}

// 長い役職を先に並べて誤マッチを防ぐ。
const ROLE_SUFFIXES = [
  "モーターボート競走事業管理者",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "副部長",
  "副課長",
  "管理者",
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
  "委員",
  "議員",
];

const ANSWER_ROLES = new Set([
  "モーターボート競走事業管理者",
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "管理者",
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
]);

function normalizeWhitespace(text: string): string {
  return toHalfWidthDigits(text)
    .replace(/[\s　]+/g, " ")
    .trim();
}

function normalizeRole(text: string): string {
  return normalizeWhitespace(text).replace(/ /g, "");
}

function normalizeName(text: string): string {
  return normalizeWhitespace(text).replace(/ /g, "");
}

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長 辻本 一夫君
 *   ○町長 貝掛 俊之君
 *   ○議員 ８番 松岡 泉君
 *   ○８番（松岡泉君）
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = normalizeWhitespace(text).replace(/^[○◯◎●]\s*/, "");

  const parenMatch = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)$/);
  if (parenMatch) {
    const rolePart = normalizeRole(parenMatch[1]!);
    const speakerName = normalizeName(parenMatch[2]!);
    const content = parenMatch[3]!.trim();

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

  const numberMatch = stripped.match(/^(?:議員\s*)?\d+番\s+(.+?)(?:君|様|議員)\s+([\s\S]*)$/);
  if (numberMatch) {
    return {
      speakerName: normalizeName(numberMatch[1]!),
      speakerRole: "議員",
      content: numberMatch[2]!.trim(),
    };
  }

  const spacedMatch = stripped.match(/^(.+?)\s+(.+?)(?:君|様|議員)\s+([\s\S]*)$/);
  if (spacedMatch) {
    const rolePart = normalizeRole(spacedMatch[1]!);
    const speakerName = normalizeName(spacedMatch[2]!);
    const content = spacedMatch[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName, speakerRole: suffix, content };
      }
    }

    return { speakerName, speakerRole: rolePart || null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
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
  for (const answerRole of ANSWER_ROLES) {
    if (speakerRole.endsWith(answerRole)) return "answer";
  }
  return "question";
}

/** PDF 冒頭付近の和暦日付から開催日を抽出する */
export function parseHeldOn(text: string): string | null {
  return parseJapaneseDate(text);
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) continue;

    const normalized = normalizeWhitespace(trimmed);
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
      `[403814-ashiya] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: AshiyaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = params.heldOn ?? parseHeldOn(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const attachmentId = extractAttachmentId(params.pdfUrl);

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: attachmentId ? `ashiya_${attachmentId}` : `ashiya_${heldOn}`,
    statements,
  };
}
