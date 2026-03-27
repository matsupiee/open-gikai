/**
 * 穴水町議会 — detail フェーズ
 *
 * PDF からテキストを抽出し、○/〇 マーカー付きの発言を分割して
 * ParsedStatement 配列を生成する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AnamizuMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "会計管理者",
  "事務局次長",
  "事務局長",
  "センター長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "次長",
  "所長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "主任",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "会計管理者",
  "事務局次長",
  "事務局長",
  "センター長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "次長",
  "所長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "主任",
]);

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

/** PDF 本文から開催日を抽出する */
export function parseHeldOn(text: string): string | null {
  const match = text.match(
    /招\s*集\s*年\s*月\s*日\s*(令和|平成)(元|[0-9０-９]+)年\s*([0-9０-９]+)月\s*([0-9０-９]+)日/
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(normalizeDigits(match[2]!), 10);
  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  const month = String(parseInt(normalizeDigits(match[3]!), 10)).padStart(2, "0");
  const day = String(parseInt(normalizeDigits(match[4]!), 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 発言ヘッダーから発言者情報を抽出する */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○〇◯●]\s*/, "").trim();
  const match = stripped.match(
    /^(.+?)[（(]([^）)]+?)(?:君|議員|氏)?[）)]\s*([\s\S]*)/
  );

  if (!match) {
    return { speakerName: null, speakerRole: null, content: stripped };
  }

  const rolePart = match[1]!.replace(/\s+/g, "").trim();
  const rawName = match[2]!.replace(/\s+/g, "").trim();
  const content = match[3]!.trim();

  if (/^[\d０-９]+番$/.test(rolePart)) {
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

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
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

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * 穴水町の PDF は主に「○議長（氏名）」形式。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○〇◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (!/^[○〇◯●]/.test(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, " ").trim();
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!speakerName && !speakerRole) continue;

    const normalizedContent = content.replace(/\s+/g, " ").trim();
    if (!normalizedContent) continue;

    const contentHash = createHash("sha256")
      .update(normalizedContent)
      .digest("hex");
    const startOffset = offset;
    const endOffset = offset + normalizedContent.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: normalizedContent,
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

    const { extractText, getDocumentProxy } = await import("../../../utils/pdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[174611-anamizu] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** PDF をダウンロード・テキスト抽出し、MeetingData に変換する */
export async function fetchMeetingData(
  meeting: AnamizuMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = parseHeldOn(text) ?? meeting.heldOn;
  if (!heldOn) return null;

  const idMatch = meeting.pdfUrl.match(/\/uploaded\/attachment\/(\d+)\.pdf$/i);
  const externalId = idMatch ? `anamizu_${idMatch[1]}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
