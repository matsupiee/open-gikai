/**
 * 八幡平市議会 -- detail フェーズ
 *
 * Shift_JIS の静的 HTML 本文から `〇<b>...</b>` 形式の発言を抽出する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HachimantaiMeeting } from "./list";
import { fetchShiftJisPage, normalizeDigits, normalizeText } from "./shared";

const ROLE_SUFFIXES = [
  "臨時委員長",
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
  "センター長",
  "課長補佐",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "副所長",
  "所長",
  "副室長",
  "室長",
  "局長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "係長",
  "技監",
  "技師",
  "委員",
  "議員",
] as const;

const ANSWER_ROLES = new Set<string>([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "議会事務局長",
  "事務局長",
  "センター長",
  "課長補佐",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "所長",
  "副所長",
  "室長",
  "副室長",
  "局長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "係長",
  "技監",
  "技師",
]);

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(text: string): string {
  return decodeHtmlEntities(text.replace(/<[^>]+>/g, " "));
}

function normalizeSpeakerName(text: string): string {
  return normalizeText(text).replace(/\s+/g, "");
}

function toSpeakerRole(rolePart: string): string | null {
  const normalizedRole = normalizeDigits(normalizeText(rolePart));
  if (/^\d+番$/.test(normalizedRole)) return "議員";

  for (const suffix of ROLE_SUFFIXES) {
    if (normalizedRole === suffix || normalizedRole.endsWith(suffix)) {
      return suffix;
    }
  }

  return normalizedRole || null;
}

/** 話者ラベルから氏名と役職を抽出する */
export function parseSpeaker(label: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const normalized = normalizeText(label).replace(/^[〇○◯]\s*/, "");

  const parenthesizedMatch = normalized.match(
    /^(.+?)[（(](.+?)(?:君|議員|氏|さん)?[）)]$/,
  );
  if (parenthesizedMatch) {
    return {
      speakerName: normalizeSpeakerName(parenthesizedMatch[2]!),
      speakerRole: toSpeakerRole(parenthesizedMatch[1]!),
    };
  }

  const spacedMatch = normalized.match(/^(.+?)[\s　]+(.+?)(?:君|議員|氏|さん)$/);
  if (spacedMatch) {
    return {
      speakerName: normalizeSpeakerName(spacedMatch[2]!),
      speakerRole: toSpeakerRole(spacedMatch[1]!),
    };
  }

  return {
    speakerName: null,
    speakerRole: toSpeakerRole(normalized),
  };
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
    speakerRole === "臨時委員長"
  ) {
    return "remark";
  }

  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }

  return "question";
}

function normalizeContent(text: string): string {
  return stripTags(text).replace(/\s+/g, " ").trim();
}

/** 本文 HTML から発言配列を抽出する */
export function parseStatements(html: string): ParsedStatement[] {
  const source = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\r/g, "");

  const statements: ParsedStatement[] = [];
  const blocks = source.split(/(?=[〇○◯]\s*<b>)/);
  let offset = 0;

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (!/^[〇○◯]\s*<b>/i.test(trimmedBlock)) continue;

    const speakerMatch = trimmedBlock.match(
      /^[〇○◯]\s*<b>([\s\S]*?)<\/b>\s*([\s\S]*)$/i,
    );
    if (!speakerMatch) continue;

    const speaker = parseSpeaker(stripTags(speakerMatch[1]!));
    const body = speakerMatch[2]!.replace(/<br\s*\/?>/gi, "\n");
    const content = body
      .split("\n")
      .map((line) => line.trim())
      .map((line) => ({ html: line, text: normalizeContent(line) }))
      .filter(({ text }) => text.length > 0)
      .filter(({ text }) => !/^[◎●☆]/.test(text))
      .filter(({ text }) => !/^[（(]\d+時\d+分[）)]$/.test(text))
      .filter(
        ({ text }) =>
          !/^[（(].*(登壇|退席|退場|着席|「.+」の声あり|拍手).*[）)]$/.test(text),
      )
      .filter(({ html }) => !/^<a name=/i.test(html))
      .filter(({ html }) => !/<b>/i.test(html))
      .map(({ text }) => text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!content) {
      continue;
    }

    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(speaker.speakerRole),
      speakerName: speaker.speakerName,
      speakerRole: speaker.speakerRole,
      content,
      contentHash: createHash("sha256").update(content).digest("hex"),
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  return statements;
}

/** HTML を取得し MeetingData に変換する */
export async function fetchMeetingData(
  meeting: HachimantaiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchShiftJisPage(meeting.mainUrl);
  if (!html) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  const pathname = new URL(meeting.mainUrl).pathname;
  const baseName = pathname.split("/").pop()?.replace(/\.html$/i, "") ?? "";
  const externalId = baseName ? `hachimantai_${baseName}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.mainUrl,
    externalId,
    statements,
  };
}
