/**
 * 浜中町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * ○ マーカー付きの話者見出しごとに発言を分割する。
 */

import { createHash } from "node:crypto";
import { extractPdfText } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HamanakaMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

const ROLE_SUFFIXES = [
  "議会運営委員会委員長",
  "総務経済常任委員会委員長",
  "社会文教常任委員会委員長",
  "産業建設常任委員会委員長",
  "総務文教常任委員会委員長",
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副教育長",
  "代表監査委員",
  "農業委員会会長",
  "企画財政課長",
  "住民環境課長",
  "健康福祉課長",
  "商工観光課長",
  "農林課長",
  "水産課長",
  "管理課長",
  "総務課長",
  "税務課長",
  "議事係長",
  "防災対策室長",
  "給食センター所長",
  "保育所長",
  "教育長",
  "事務局長",
  "会計管理者",
  "病院長",
  "議長",
  "町長",
  "次長",
  "課長",
  "室長",
  "局長",
  "所長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "副町長",
  "副教育長",
  "代表監査委員",
  "農業委員会会長",
  "企画財政課長",
  "住民環境課長",
  "健康福祉課長",
  "商工観光課長",
  "農林課長",
  "水産課長",
  "管理課長",
  "総務課長",
  "税務課長",
  "議事係長",
  "防災対策室長",
  "給食センター所長",
  "保育所長",
  "教育長",
  "事務局長",
  "会計管理者",
  "病院長",
  "町長",
  "次長",
  "課長",
  "室長",
  "局長",
  "所長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

function preprocessText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\f/g, "\n")
    .replace(/^\s*-\s*\d+\s*-\s*$/gm, "")
    .replace(/\s-\s*\d+\s-\s*/g, " ")
    .trim();
}

function cleanStatementContent(content: string): string {
  return content
    .replace(/\s[―─]{5,}[\s\S]*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 話者見出しから発言者情報を抽出する */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|議員|委員)?[）)]\s*([\s\S]*)$/,
  );

  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    return {
      speakerName: rawName || null,
      speakerRole: rolePart || null,
      content,
    };
  }

  const headerMatch = stripped.match(/^([^\s　]{1,40})[\s　]+([\s\S]*)$/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    if (/^[\d０-９]+番$/.test(header)) {
      return { speakerName: null, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (header === suffix) {
        return { speakerName: null, speakerRole: suffix, content };
      }
      if (header.endsWith(suffix)) {
        const name = header.slice(0, -suffix.length).trim();
        return {
          speakerName: name || null,
          speakerRole: suffix,
          content,
        };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類する */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長" ||
    speakerRole.endsWith("委員長")
  ) {
    return "remark";
  }
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを発言配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const cleaned = preprocessText(text);
  const blocks = cleaned.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, " ").trim();
    const parsed = parseSpeaker(normalized);
    const content = cleanStatementContent(parsed.content);
    if (!content) continue;

    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(parsed.speakerRole),
      speakerName: parsed.speakerName,
      speakerRole: parsed.speakerRole,
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
      startOffset: offset,
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

    return extractPdfText(buffer, {
      pdfUrl,
      strategy: ["unpdf", "pdftotext"],
      tempPrefix: "hamanaka",
      isUsable: (text) => /[○◯◎●]/.test(text),
    });
  } catch (err) {
    console.warn(
      `[016632-hamanaka] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildExternalId(pdfUrl: string): string | null {
  const fileName = new URL(pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "");
  return fileName ? `hamanaka_${fileName.toLowerCase()}` : null;
}

/**
 * 会議録 PDF を MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HamanakaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.section),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: buildExternalId(meeting.pdfUrl),
    statements,
  };
}
