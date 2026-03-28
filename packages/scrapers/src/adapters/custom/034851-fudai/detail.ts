/**
 * 普代村議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * 「柾屋村長。」「4番齊藤議員。」のような見出しで発言を分割する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FudaiMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

const ROLE_SUFFIXES = [
  "税務出納課長兼会計管理者",
  "観光振興室長兼休養施設管理員",
  "医科・歯科診療所事務長",
  "産業経済常任委員会委員長",
  "議会運営委員会委員長",
  "総務教育民生常任委員会委員長",
  "住民福祉課長",
  "建設水産課長",
  "農林商工課長",
  "政策推進室長",
  "議長代理",
  "副委員長",
  "委員長",
  "副議長",
  "副村長",
  "教育長",
  "事務局長",
  "会計管理者",
  "総務課長",
  "事務長",
  "教育次長",
  "次長",
  "局長",
  "課長",
  "室長",
  "村長",
  "議長",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "総務課長",
  "住民福祉課長",
  "建設水産課長",
  "農林商工課長",
  "政策推進室長",
  "税務出納課長兼会計管理者",
  "観光振興室長兼休養施設管理員",
  "医科・歯科診療所事務長",
  "教育次長",
  "事務局長",
  "会計管理者",
  "次長",
  "局長",
  "課長",
  "室長",
  "事務長",
]);

const JAPANESE_TOKEN =
  "[一-龠々ぁ-ゖァ-ヺーA-Za-z0-9０-９・-]";

const ROLE_PATTERN = ROLE_SUFFIXES.map((suffix) =>
  suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
).join("|");

const SPEAKER_HEADER_PATTERN = new RegExp(
  `([0-9０-９]+番${JAPANESE_TOKEN}{1,12}議員|${JAPANESE_TOKEN}{0,20}(?:${ROLE_PATTERN}))。`,
  "gu",
);

function shouldDropPageLeadingLine(line: string): boolean {
  if (line.length > 16) return false;
  if (/[。！？]$/.test(line)) return false;
  if (/[「」『』（）()]/.test(line)) return false;
  return true;
}

/** ページ番号と欄外ヘッダを落として本文だけに寄せる */
export function stripPageArtifacts(pageText: string): string {
  const lines = pageText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";
  if (/^\d+$/.test(lines[0]!)) lines.shift();

  let removed = 0;
  while (lines.length > 0) {
    const line = lines[0]!;
    if (!shouldDropPageLeadingLine(line)) break;
    lines.shift();
    removed += 1;
    if (removed >= 8) break;
  }

  return lines.join("\n").trim();
}

/** ページ単位のテキストを本文として連結する */
export function mergePageTexts(pageTexts: string[]): string {
  return pageTexts.map(stripPageArtifacts).filter(Boolean).join("\n");
}

/** PDF 抽出テキストの不要な空白を詰める */
export function normalizeText(text: string): string {
  let normalized = text.replace(/[\u3000\r\n\t]+/g, " ").replace(/\s+/g, " ");

  for (let i = 0; i < 6; i += 1) {
    const compacted = normalized.replace(
      /([一-龠々ぁ-ゖァ-ヺーA-Za-z0-9０-９・-])\s+(?=[一-龠々ぁ-ゖァ-ヺーA-Za-z0-9０-９・-])/gu,
      "$1",
    );
    if (compacted === normalized) break;
    normalized = compacted;
  }

  normalized = normalized.replace(
    /([。、「」『』（）()])\s+(?=[一-龠々ぁ-ゖァ-ヺーA-Za-z0-9０-９])/gu,
    "$1",
  );

  return normalized.trim();
}

/** 見出しから発言者情報を抽出する */
export function parseSpeakerHeader(header: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const normalized = header.trim();
  const numberedMember = normalized.match(/^([0-9０-９]+)番(.+?)議員$/);
  if (numberedMember) {
    return {
      speakerName: numberedMember[2] || null,
      speakerRole: "議員",
    };
  }

  const committeeChair = normalized.match(/^(?:.+?委員会)?(.+?)委員長$/);
  if (committeeChair) {
    return {
      speakerName: committeeChair[1] || null,
      speakerRole: "委員長",
    };
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (normalized === suffix) {
      return { speakerName: null, speakerRole: suffix };
    }
    if (normalized.endsWith(suffix)) {
      const name = normalized.slice(0, -suffix.length).trim();
      return {
        speakerName: name || null,
        speakerRole: suffix,
      };
    }
  }

  return { speakerName: null, speakerRole: null };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "議長代理" ||
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

function cleanStatementContent(content: string): string {
  return content
    .replace(/\(\d+[:：]\d+\)/g, " ")
    .replace(/（\d+[:：]\d+）/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const headers = [...normalized.matchAll(SPEAKER_HEADER_PATTERN)];
  if (headers.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < headers.length; i += 1) {
    const current = headers[i]!;
    const next = headers[i + 1];
    const header = current[1]!;
    const contentStart = current.index! + current[0].length;
    const contentEnd = next ? next.index! : normalized.length;
    const content = cleanStatementContent(normalized.slice(contentStart, contentEnd));
    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeakerHeader(header);
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
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
    const { extractText, getDocumentProxy } = await import("../../../utils/pdf");
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    return mergePageTexts(text);
  } catch (err) {
    console.warn(
      `[034851-fudai] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildExternalId(pdfUrl: string): string | null {
  const fileName = new URL(pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "");
  return fileName ? `fudai_${fileName}` : null;
}

/**
 * 会議録 PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: FudaiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: buildExternalId(meeting.pdfUrl),
    statements,
  };
}
