/**
 * 片品村議会（群馬県） — detail フェーズ
 *
 * PDF から会議録本文を抽出し、役職（氏名君）ヘッダー単位で発言を分割する。
 * 片品村の PDF では丸マーカーが落ちるため、ヘッダーパターンで境界を見つける。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  collapseWhitespace,
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
  parseWarekiDate,
  toHalfWidth,
} from "./shared";

export interface KatashinaDetailParams {
  title: string;
  sessionTitle: string;
  pdfUrl: string;
  meetingType: "plenary" | "committee" | "extraordinary";
  heldOnHint: string | null;
}

const SPEAKER_ROLE_SOURCE = String.raw`(?:\d+番|(?:副)?議長|(?:副)?村長|(?:副)?教育長|会計管理者|[一-龯ぁ-んァ-ヶ々ー]+(?:事務局長|課長|部長|次長|室長|所長|参事|主幹|補佐|委員長)|委員|議員)`;
const SPEAKER_HEADER_SOURCE =
  String.raw`${SPEAKER_ROLE_SOURCE}（[^）]{1,20}(?:君|様|議員)）`;
const SPEAKER_HEADER_PATTERN = new RegExp(SPEAKER_HEADER_SOURCE, "g");

const ANSWER_ROLE_SUFFIXES = [
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "会計管理者",
  "事務局長",
  "課長",
  "部長",
  "次長",
  "室長",
  "所長",
  "参事",
  "主幹",
  "補佐",
] as const;

function removeInterCharacterSpaces(text: string): string {
  let result = text;

  for (let i = 0; i < 5; i += 1) {
    const next = result.replace(
      /([一-龯ぁ-んァ-ヶ々ーA-Za-z0-9０-９（）()「」『』【】［］、。，．・:：;；!?！？\-－])\s+(?=[一-龯ぁ-んァ-ヶ々ーA-Za-z0-9０-９（）()「」『』【】［］、。，．・:：;；!?！？\-－])/g,
      "$1",
    );
    if (next === result) break;
    result = next;
  }

  return result;
}

function normalizePdfText(text: string): string {
  return removeInterCharacterSpaces(
    collapseWhitespace(
      text
        .replace(/[－-]\s*\d+\s*[－-]/g, " ")
        .replace(/───────────────────────────────────+/g, " ")
        .replace(/\s+/g, " "),
    ),
  );
}

function trimTrailingAgendaHeading(text: string): string {
  return text
    .replace(/日程第\d+(?!、|,).+$/u, "")
    .replace(/本日の会議に付した事件.+$/u, "")
    .trim();
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return normalizePdfText(text);
  } catch (error) {
    console.warn(
      `[104434-katashina] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function extractMeetingTitleFromText(text: string): string | null {
  const normalized = normalizePdfText(text);
  const match = normalized.match(
    /((?:令和|平成)(?:元|\d+)年第\d+回片品村議会(?:定例会|臨時会)会議録第\d+号)/,
  );
  return match?.[1] ?? null;
}

export function parseHeldOnFromText(text: string): string | null {
  return parseWarekiDate(normalizePdfText(text));
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const normalized = normalizePdfText(text).replace(/^[○◯〇◎●]\s*/, "");
  const match = normalized.match(/^(.+?)（(.+?)(?:君|様|議員)）\s*([\s\S]*)$/);
  if (!match) {
    return {
      speakerName: null,
      speakerRole: null,
      content: normalized.trim(),
    };
  }

  const rolePart = removeInterCharacterSpaces(match[1] ?? "").trim();
  const speakerName = removeInterCharacterSpaces(match[2] ?? "")
    .replace(/\s+/g, "")
    .trim();
  const content = (match[3] ?? "").trim();

  if (/^\d+番$/.test(toHalfWidth(rolePart))) {
    return {
      speakerName: speakerName || null,
      speakerRole: "議員",
      content,
    };
  }

  return {
    speakerName: speakerName || null,
    speakerRole: rolePart || null,
    content,
  };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (speakerRole === "議長" || speakerRole === "副議長" || speakerRole.endsWith("委員長")) {
    return "remark";
  }
  if (
    ANSWER_ROLE_SUFFIXES.some(
      (suffix) => speakerRole === suffix || speakerRole.endsWith(suffix),
    )
  ) {
    return "answer";
  }
  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizePdfText(text);
  const statements: ParsedStatement[] = [];
  const headers = [...normalized.matchAll(SPEAKER_HEADER_PATTERN)];
  let offset = 0;

  for (let index = 0; index < headers.length; index += 1) {
    const start = headers[index]?.index;
    if (start === undefined) continue;

    const end = headers[index + 1]?.index ?? normalized.length;
    const trimmed = normalized.slice(start, end).trim();

    const parsed = parseSpeaker(trimmed);
    if (!parsed.speakerRole || !parsed.content) continue;

    const content = trimTrailingAgendaHeading(parsed.content);
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(parsed.speakerRole),
      speakerName: parsed.speakerName,
      speakerRole: parsed.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

export async function fetchMeetingData(
  params: KatashinaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOnFromText(text) ?? params.heldOnHint;
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const title = extractMeetingTitleFromText(text) ?? params.title;
  const externalIdKey = extractExternalIdKey(params.pdfUrl);

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: externalIdKey ? `katashina_${externalIdKey}` : null,
    statements,
  };
}
