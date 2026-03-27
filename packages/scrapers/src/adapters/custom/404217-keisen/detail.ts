/**
 * 桂川町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキスト抽出し、
 * 「○役職（氏名君）」形式の発言を ParsedStatement に変換する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KeisenMeeting } from "./list";
import { fetchBinary, toHalfWidth } from "./shared";

const ROLE_SUFFIXES = [
  "議会運営委員長",
  "総務経済建設委員長",
  "文教厚生委員長",
  "議会広報委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "教育長",
  "会計管理者",
  "議会事務局長",
  "事務局長",
  "課長補佐",
  "課長",
  "館長",
  "局長",
  "室長",
  "部長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
] as const;

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "会計管理者",
  "議会事務局長",
  "事務局長",
  "課長補佐",
  "課長",
  "館長",
  "局長",
  "室長",
  "部長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

const SPEAKER_MARKER = /^[○◯〇◎●]/;

/** 議事本文の開始位置を推定する */
export function findProceedingsStart(text: string): number {
  const match = text.match(
    /(?:午前|午後)\s*[０-９\d]+\s*時\s*[０-９\d]*\s*分\s*(?:開会|開議|再開)/,
  );
  return match?.index ?? 0;
}

/** 発言者ヘッダーから話者情報を抽出する */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");

  const numberBracketMatch = stripped.match(
    /^[\d０-９]+番[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (numberBracketMatch) {
    const name = numberBracketMatch[1]!.replace(/[\s\u3000]+/g, "").trim();
    const content = numberBracketMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  const roleBracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (roleBracketMatch) {
    const rolePart = roleBracketMatch[1]!.trim();
    const name = roleBracketMatch[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = roleBracketMatch[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: name, speakerRole: rolePart || null, content };
  }

  const headerMatch = stripped.match(/^([^\s\u3000]{1,40})[\s\u3000]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header === suffix || header.endsWith(suffix)) {
        const name =
          header.length > suffix.length ? header.slice(0, -suffix.length) : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類する */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長" ||
    speakerRole.endsWith("委員長")
  ) {
    return "remark";
  }
  for (const answerRole of ANSWER_ROLES) {
    if (speakerRole.endsWith(answerRole)) return "answer";
  }
  return "question";
}

function isNoiseLine(line: string): boolean {
  const normalized = toHalfWidth(line);
  return (
    /^[-－]\s*\d+\s*[-－]$/.test(normalized) ||
    /^[─\-\s]+$/.test(normalized) ||
    /^[癩癘・]+$/.test(normalized) ||
    /^日程第\d+[．.]/.test(normalized) ||
    /^議事日程/.test(normalized) ||
    /^本日の会議に付した事件/.test(normalized)
  );
}

/** 発言本文から議題見出しやページ装飾を除去する */
export function normalizeContent(text: string): string {
  return text
    .replace(/^\s*[-－]\s*\d+\s*[-－]\s*$/gm, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isNoiseLine(line))
    .join(" ")
    .replace(/[\s\u3000]+/g, " ")
    .trim();
}

/** PDF テキストを発言単位に分割する */
export function parseStatements(text: string): ParsedStatement[] {
  const start = findProceedingsStart(text);
  const bodyText = start > 0 ? text.slice(start) : text;
  const blocks = bodyText.split(/(?=[○◯〇◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !SPEAKER_MARKER.test(trimmed)) continue;

    const normalizedBlock = trimmed.replace(/\r/g, "");
    const { speakerName, speakerRole, content } = parseSpeaker(normalizedBlock);
    const normalizedContent = normalizeContent(content);
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

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text : null;
  } catch (err) {
    console.warn(
      `[404217-keisen] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `keisen_${match[1]!.toLowerCase()}`;
}

/** PDF をダウンロード・テキスト抽出し、MeetingData に変換する */
export async function fetchMeetingData(
  meeting: KeisenMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: buildExternalId(meeting.pdfUrl),
    statements,
  };
}
