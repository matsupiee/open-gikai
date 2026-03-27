/**
 * 会津坂下町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、`◎議長（...君）` 形式の
 * 発言ブロックを ParsedStatement 配列に変換する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AizubangeMeeting } from "./list";
import {
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
} from "./shared";

const ROLE_SUFFIXES = [
  "課長補佐",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "代表監査委員",
  "監査委員",
  "会計管理者",
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
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "代表監査委員",
  "監査委員",
  "会計管理者",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

function normalizePdfText(text: string): string {
  return text
    .replace(/\f/g, "\n")
    .replace(/\s+\d+\s*\/\s*第\s*\d+\s*日/g, " ");
}

function cleanStageDirectionPrefix(content: string): string {
  return content
    .replace(/^(?:[（(](?:登壇|退席|退場|着席)[）)]\s*)+/g, "")
    .trim();
}

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ◎副議長（山口 享君） 許可します。
 *   ◎10番（五十嵐一夫君） 議長、10番。
 *   ◎庁舎整備課長（遠藤幸喜君） ご説明いたします。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");

  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = cleanStageDirectionPrefix(match[3]!.trim());

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  const headerMatch = stripped.match(/^([^\s　]{1,40})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = cleanStageDirectionPrefix(headerMatch[2]!.trim());

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
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

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
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
    if (!content) continue;
    if (/^[（(](?:登壇|退席|退場|着席)[）)]$/.test(content)) continue;

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
      `[074217-aizubange] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: AizubangeMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const normalizedText = normalizePdfText(text);
  if (normalizedText.replace(/[\s\d/第日]+/g, "").length < 20) {
    console.warn(
      `[074217-aizubange] PDF text appears empty or image-based: ${meeting.pdfUrl}`,
    );
    return null;
  }

  const statements = parseStatements(normalizedText);
  if (statements.length === 0) {
    console.warn(
      `[074217-aizubange] no statements extracted: ${meeting.pdfUrl}`,
    );
    return null;
  }

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `aizubange_${idKey}` : null;

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
