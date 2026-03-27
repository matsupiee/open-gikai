/**
 * 双葉町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * 〇 / ◎ マーカーをもとに発言を分割する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  buildExternalId,
  convertWarekiYear,
  detectMeetingType,
  fetchBinary,
  toHalfWidth,
} from "./shared";

export interface FutabaDetailParams {
  title: string;
  pdfUrl: string;
  yearPageUrl: string;
}

const SPEAKER_MARKERS = /^[〇○◯◎●]/;

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "臨時議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
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
  "事務局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

const HONORIFIC_OPTIONAL_SUFFIXES = [
  "臨時議長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
];

function normalizeText(text: string): string {
  return toHalfWidth(text)
    .replace(/\r?\n/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * PDF 本文から開催日を抽出する。
 */
export function parseHeldOnFromText(text: string): string | null {
  const normalized = normalizeText(text);

  const patterns = [
    /議事日程[\s\S]{0,120}?(令和|平成)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/,
    /第1号[\s\S]{0,120}?(令和|平成)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/,
    /(令和|平成)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/g,
  ] as const;

  for (const pattern of patterns) {
    const matches =
      pattern instanceof RegExp && pattern.flags.includes("g")
        ? [...normalized.matchAll(pattern)]
        : [normalized.match(pattern)].filter(
            (match): match is RegExpMatchArray => match !== null,
          );

    for (const match of matches) {
      const year = convertWarekiYear(match[1]!, match[2]!);
      const month = parseInt(match[3]!, 10);
      const day = parseInt(match[4]!, 10);

      if (year === null) continue;
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;

      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * 発言者ヘッダーから氏名・役職・本文を抽出する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = normalizeText(text).replace(/^[〇○◯◎●]\s*/, "");

  const numberBracketMatch = stripped.match(
    /^[\d０-９]+番[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (numberBracketMatch) {
    return {
      speakerName: numberBracketMatch[1]!.replace(/[\s　]+/g, "").trim(),
      speakerRole: "議員",
      content: numberBracketMatch[2]!.trim(),
    };
  }

  const roleBracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(君|議員|様)?[）)]\s*([\s\S]*)/,
  );
  if (roleBracketMatch) {
    const rolePart = roleBracketMatch[1]!.trim();
    const rawName = roleBracketMatch[2]!.replace(/[\s　]+/g, "").trim();
    const honorific = roleBracketMatch[3] ?? null;
    const content = roleBracketMatch[4]!.trim();

    if (
      !honorific &&
      !HONORIFIC_OPTIONAL_SUFFIXES.some(
        (suffix) => rolePart === suffix || rolePart.endsWith(suffix),
      )
    ) {
      return { speakerName: null, speakerRole: null, content: stripped.trim() };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  const roleSpaceNameMatch = stripped.match(
    /^(.+?)\s+(.+?)(?:君|議員|様)\s*([\s\S]*)/,
  );
  if (roleSpaceNameMatch) {
    const rolePart = roleSpaceNameMatch[1]!.trim();
    const rawName = roleSpaceNameMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = roleSpaceNameMatch[3]!.trim();

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }
  }

  const headerMatch = stripped.match(/^([^\s　]{1,40})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header === suffix || header.endsWith(suffix)) {
        const name =
          header.length > suffix.length ? header.slice(0, -suffix.length) : null;
        return {
          speakerName: name ? name.replace(/[\s　]+/g, "").trim() : null,
          speakerRole: suffix,
          content,
        };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を判定する */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "臨時議長" ||
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

function shouldSkipBlock(
  marker: string,
  statement: { speakerName: string | null; speakerRole: string | null; content: string },
): boolean {
  if (marker === "◎") return true;

  if (
    /^[（(].+?(?:登壇|退席|退場|着席|議場閉鎖|採決終了)[）)]$/.test(
      statement.content,
    )
  ) {
    return true;
  }

  if (!statement.speakerName && !statement.speakerRole) {
    return true;
  }

  return false;
}

/**
 * PDF テキストを ParsedStatement[] に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = normalizeText(text).split(/(?=[〇○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !SPEAKER_MARKERS.test(trimmed)) continue;

    const marker = trimmed[0]!;
    const parsed = parseSpeaker(trimmed);

    if (shouldSkipBlock(marker, parsed)) continue;
    if (!parsed.content) continue;

    const contentHash = createHash("sha256")
      .update(parsed.content)
      .digest("hex");
    const startOffset = offset;
    const endOffset = startOffset + parsed.content.length;

    statements.push({
      kind: classifyKind(parsed.speakerRole),
      speakerName: parsed.speakerName,
      speakerRole: parsed.speakerRole,
      content: parsed.content,
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
    const { extractText, getDocumentProxy } = await import("../../../utils/pdf");
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[075469-futaba] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF を取得し、開催日と発言配列を含む MeetingData を返す。
 */
export async function buildMeetingData(
  params: FutabaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOnFromText(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: buildExternalId(params.pdfUrl),
    statements,
  };
}
