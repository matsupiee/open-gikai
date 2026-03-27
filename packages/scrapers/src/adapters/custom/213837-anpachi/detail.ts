import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AnpachiMeeting } from "./list";
import {
  deSpacePdfText,
  detectMeetingType,
  fetchBinary,
  normalizeFullWidth,
  parseJapaneseDate,
} from "./shared";

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "議会事務局長",
  "事務局長",
  "会計管理者",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "館長",
  "所長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "調整監",
  "書記",
  "議員",
  "委員",
] as const;

const ANSWER_ROLE_SUFFIXES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "議会事務局長",
  "事務局長",
  "会計管理者",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "館長",
  "所長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "調整監",
  "書記",
] as const);

function buildSpacedPattern(text: string): string {
  return text.split("").join("\\s*");
}

const ROLE_VARIANTS = ROLE_SUFFIXES.map((role) => ({
  role,
  pattern: buildSpacedPattern(role),
}));

const ROLE_PATTERN = [
  buildSpacedPattern("議長"),
  buildSpacedPattern("副議長"),
  buildSpacedPattern("町長"),
  buildSpacedPattern("副町長"),
  buildSpacedPattern("教育長"),
  buildSpacedPattern("副教育長"),
  buildSpacedPattern("会計管理者"),
  buildSpacedPattern("調整監"),
  buildSpacedPattern("議会事務局長"),
  buildSpacedPattern("事務局長"),
  buildSpacedPattern("書記"),
  "[\\u4E00-\\u9FFF\\u3041-\\u30FFー・]+(?:\\s*[兼]\\s*[\\u4E00-\\u9FFF\\u3041-\\u30FFー・]+)*\\s*(?:課\\s*長|部\\s*長|局\\s*長|館\\s*長|所\\s*長|参\\s*事|主\\s*幹|主\\s*査|係\\s*長)",
  "\\d+\\s*番",
].join("|");

function normalizeRoleText(text: string): string {
  return normalizeFullWidth(text).replace(/\s+/g, "");
}

function normalizeNameText(text: string): string {
  return normalizeFullWidth(text).replace(/\s+/g, "");
}

function cleanContentText(text: string): string {
  return deSpacePdfText(
    normalizeFullWidth(text)
      .replace(/[─]{10,}/g, " ")
      .replace(/－\s*\d+\s*－/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isPureCallContent(text: string): boolean {
  const normalized = cleanContentText(text);
  return new RegExp(
    `^(?:(?:${ROLE_PATTERN})\\s*)?[\\u4E00-\\u9FFF\\u3041-\\u30FFー・A-Za-z0-9\\s]{1,24}(?:君|さん)[。．]?$`,
  ).test(normalized);
}

function resolveRole(rawRole: string): string {
  const normalized = normalizeRoleText(rawRole);
  if (/^\d+番$/.test(normalized)) return "議員";
  return normalized;
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole.endsWith("委員長")
  ) {
    return "remark";
  }
  if (speakerRole === "議員") return "question";
  for (const role of ANSWER_ROLE_SUFFIXES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

export function parseSpeakerBlock(text: string): {
  rawRole: string;
  speakerRole: string;
  content: string;
  markerKey: string;
} | null {
  const normalized = normalizeFullWidth(text).trim();
  const numberMatch = normalized.match(/^(\d+\s*番)\s+([\s\S]+)$/);
  if (numberMatch) {
    const rawRole = numberMatch[1]!;
    return {
      rawRole,
      speakerRole: "議員",
      content: numberMatch[2]!.trim(),
      markerKey: normalizeRoleText(rawRole),
    };
  }

  for (const variant of ROLE_VARIANTS) {
    const regex = new RegExp(`^(${variant.pattern})\\s+([\\s\\S]+)$`);
    const match = normalized.match(regex);
    if (!match) continue;
    const rawRole = match[1]!;
    return {
      rawRole,
      speakerRole: resolveRole(rawRole),
      content: match[2]!.trim(),
      markerKey: normalizeRoleText(rawRole),
    };
  }

  const genericRoleMatch = normalized.match(
    /^([\u4E00-\u9FFF\u3041-\u30FFー・]+(?:\s*[兼]\s*[\u4E00-\u9FFF\u3041-\u30FFー・]+)*\s*(?:課\s*長|部\s*長|局\s*長|館\s*長|所\s*長|参\s*事|主\s*幹|主\s*査|係\s*長))\s+([\s\S]+)$/,
  );
  if (!genericRoleMatch) return null;

  const rawRole = genericRoleMatch[1]!;
  return {
    rawRole,
    speakerRole: resolveRole(rawRole),
    content: genericRoleMatch[2]!.trim(),
    markerKey: normalizeRoleText(rawRole),
  };
}

export function parseCueName(text: string): string | null {
  const normalized = normalizeFullWidth(text).trim();
  if (new RegExp(`^(?:${ROLE_PATTERN})\\s`).test(normalized)) return null;

  const match = normalized.match(
    /^([\u4E00-\u9FFF\u3041-\u30FFー・A-Za-z0-9\s]{1,24}?)(?:君|さん|議員)[。．]?$/,
  );
  if (!match?.[1]) return null;
  return normalizeNameText(match[1]);
}

export function extractCalledSpeaker(
  content: string,
): { markerKey: string | null; name: string } | null {
  const normalized = normalizeFullWidth(content).trim();
  const cueMatch = normalized.match(
    new RegExp(
      `(?:^|[。、]\\s*)(?:(\\d+\\s*番)|(${ROLE_PATTERN}))?\\s*([\\u4E00-\\u9FFF\\u3041-\\u30FFー・A-Za-z0-9\\s]{1,24}?)(?:君|さん)[。．]?$`,
    ),
  );
  if (!cueMatch?.[3]) return null;

  const markerSource = cueMatch[1] ?? cueMatch[2] ?? null;
  return {
    markerKey: markerSource ? normalizeRoleText(markerSource) : null,
    name: normalizeNameText(cueMatch[3]),
  };
}

export function extractHeldOn(text: string): string | null {
  const head = normalizeFullWidth(text.slice(0, 200));
  const openMatch = head.match(/((?:令和|平成)(?:元|\d+)年\s*\d+月\s*\d+日)\s*開(?:会|議)/);
  if (openMatch?.[1]) return parseJapaneseDate(openMatch[1]);
  return parseJapaneseDate(head);
}

export function extractTitle(text: string, fallbackTitle: string): string {
  const head = normalizeFullWidth(text.slice(0, 300)).replace(/\s+/g, "");
  const match = head.match(
    /((?:令和|平成)(?:元|\d+)年第\d+回安八町議会(?:定例会|臨時会))/,
  );
  return match?.[1] ?? fallbackTitle;
}

export function parseStatements(rawText: string): ParsedStatement[] {
  const normalized = normalizeFullWidth(rawText)
    .replace(/－\s*\d+\s*－/g, " ")
    .replace(/[─]{10,}/g, "\n")
    .replace(
      new RegExp(`([。〕」）])\\s+(?=(?:${ROLE_PATTERN})\\s)`, "g"),
      "$1\n",
    );

  const startIndex = normalized.search(/（開(?:会|議)時間/);
  const body = startIndex >= 0 ? normalized.slice(startIndex) : normalized;
  const parts = body
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const statements: ParsedStatement[] = [];
  let offset = 0;
  let current:
    | {
        speakerName: string | null;
        speakerRole: string;
        markerKey: string;
        contentParts: string[];
      }
    | null = null;
  let pendingCalledSpeaker: { markerKey: string | null; name: string } | null = null;

  function flushCurrent() {
    if (!current) return;
    const content = cleanContentText(current.contentParts.join(" "));
    if (!content) {
      current = null;
      return;
    }
    if (current.speakerRole.endsWith("議長") && isPureCallContent(content)) {
      current = null;
      return;
    }

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(current.speakerRole),
      speakerName: current.speakerName,
      speakerRole: current.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    current = null;
  }

  for (const part of parts) {
    const parsed = parseSpeakerBlock(part);

    if (!parsed) {
      if (current) current.contentParts.push(part);
      continue;
    }

    let calledFromChair: { markerKey: string | null; name: string } | null = null;
    if (current && current.speakerRole.endsWith("議長")) {
      calledFromChair = extractCalledSpeaker(
        cleanContentText(current.contentParts.join(" ")),
      );
      if (parsed.speakerRole === "議員" && !calledFromChair) {
        current.contentParts.push(part);
        continue;
      }
      if (calledFromChair) pendingCalledSpeaker = calledFromChair;
    }
    flushCurrent();

    const cueName = parseCueName(parsed.content);
    if (cueName) {
      pendingCalledSpeaker = {
        markerKey: parsed.markerKey,
        name: cueName,
      };
      continue;
    }

    let speakerName: string | null = null;
    if (pendingCalledSpeaker) {
      if (
        pendingCalledSpeaker.markerKey === null ||
        pendingCalledSpeaker.markerKey === parsed.markerKey ||
        parsed.speakerRole === "議員"
      ) {
        speakerName = pendingCalledSpeaker.name;
        pendingCalledSpeaker = null;
      }
    }

    current = {
      speakerName,
      speakerRole: parsed.speakerRole,
      markerKey: parsed.markerKey,
      contentParts: [parsed.content],
    };
  }

  flushCurrent();
  return statements;
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (e) {
    console.warn(
      `[213837-anpachi] PDF extraction failed: ${pdfUrl}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: AnpachiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const heldOn = extractHeldOn(text);
  if (!heldOn) return null;

  const title = extractTitle(text, meeting.title);
  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.detailUrl,
    externalId: `anpachi_${meeting.pageId}`,
    statements,
  };
}
