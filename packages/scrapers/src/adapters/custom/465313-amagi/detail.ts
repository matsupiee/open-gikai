/**
 * 天城町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（実測）:
 *   ○議長（上岡 義茂議員） ただいまから…
 *   ○町長（森田 弘光君） お答えいたします。
 *   ○６番（奥 好生議員） 一般質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AmagiMeeting } from "./list";
import { fetchBinary } from "./shared";

const ROLE_SUFFIXES = [
  "選挙管理委員会書記長",
  "農業委員会事務局長",
  "議会事務局長",
  "課長補佐兼係長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "会計管理者",
  "課長補佐",
  "書記長",
  "事務局長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "書記",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "会計管理者",
  "課長補佐兼係長",
  "書記長",
  "事務局長",
  "局長",
  "課長補佐",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "書記",
]);

const ROLE_PART_HINTS = [
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "議長",
  "副議長",
  "委員長",
  "副委員長",
  "総務",
  "企画",
  "財政",
  "くらし",
  "税務",
  "長寿",
  "子育て",
  "けんこう",
  "増進",
  "商工",
  "水産",
  "観光",
  "社会教育",
  "教委",
  "農政",
  "農地",
  "建設",
  "会計",
  "議会",
  "農業委員会",
  "選挙管理委員会",
  "水道",
];

function cleanStatementContent(text: string): string {
  const beforeSection = text.split(/\s*△\s+(?=(?:日程第|開会|散会|休憩|再開))/)[0] ?? text;

  return beforeSection
    .replace(/－\d+－/g, " ")
    .replace(/─+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpacedNameAndRole(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} | null {
  const match = text.match(/^([^\s　]+)[\s　]+([^\s　]+)[\s　]+([\s\S]*)$/);
  if (!match) return null;

  const familyName = match[1]!;
  const givenAndRole = match[2]!;
  const content = match[3]!.trim();
  if (!content) return null;

  for (let splitAt = 1; splitAt < givenAndRole.length; splitAt++) {
    const givenName = givenAndRole.slice(0, splitAt);
    const rolePart = givenAndRole.slice(splitAt);

    if (!ROLE_PART_HINTS.some((hint) => rolePart.startsWith(hint))) continue;
    if (!ROLE_SUFFIXES.some((suffix) => rolePart.endsWith(suffix))) continue;

    return {
      speakerName: `${familyName}${givenName}`.replace(/[\s　]+/g, "").trim(),
      speakerRole: rolePart,
      content,
    };
  }

  return null;
}

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  const bracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員|さん)[）)]\s*([\s\S]*)/,
  );
  if (bracketMatch) {
    const rolePart = bracketMatch[1]!.trim();
    const rawName = bracketMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = bracketMatch[3]!.trim();

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

  const spacedNameAndRole = parseSpacedNameAndRole(stripped);
  if (spacedNameAndRole) {
    return spacedNameAndRole;
  }

  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name = header.length > suffix.length ? header.slice(0, -suffix.length) : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    if (/^[\d０-９]+番$/.test(header)) {
      return { speakerName: null, speakerRole: "議員", content };
    }

    return { speakerName: header, speakerRole: null, content };
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
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    const normalized = trimmed.replace(/\s+/g, " ").trim();
    if (/^[○◯◎●]\s*(?:追加)?日程第/.test(normalized)) continue;
    if (/^[◎]/.test(normalized)) continue;
    if (/^[○◯◎●].*[（(](?:登壇|退席|退場|着席)[）)]\s*$/.test(normalized)) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!speakerRole && speakerName?.match(/^(?:追加)?日程第/)) continue;

    const cleanedContent = cleanStatementContent(content);
    if (!cleanedContent) continue;

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
      `[465313-amagi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF を MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: AmagiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const fileName = new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `amagi_${fileName}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
