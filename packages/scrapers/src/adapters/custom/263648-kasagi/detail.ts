/**
 * 笠置町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KasagiMeetingRecord } from "./list";
import {
  detectMeetingType,
  fetchBinary,
  normalizeDigits,
  normalizeWhitespace,
  parseJapaneseDate,
} from "./shared";

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議会事務局長",
  "課長事務取扱",
  "担当課長",
  "会計管理者",
  "副町長",
  "教育長",
  "事務局長",
  "議長",
  "町長",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
  "主任",
  "委員",
  "議員",
];

const ANSWER_ROLES = new Set([
  "議会事務局長",
  "課長事務取扱",
  "担当課長",
  "会計管理者",
  "町長",
  "副町長",
  "教育長",
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
  "次長",
  "主査",
  "補佐",
  "主任",
]);

const REMARK_ROLES = new Set(["議長", "副議長", "委員長", "副委員長"]);

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = normalizeWhitespace(text.replace(/^[○◯◎●]\s*/, ""));

  const parenMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員|さん)[）)]\s*([\s\S]*)/,
  );
  if (parenMatch) {
    const rolePart = normalizeWhitespace(parenMatch[1]!);
    const rawName = normalizeWhitespace(parenMatch[2]!).replace(/\s+/g, "");
    const content = normalizeWhitespace(parenMatch[3]!);

    if (/^[\d０-９]+番$/.test(normalizeDigits(rolePart))) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  const headerMatch = stripped.match(/^([^\s]{1,40})\s+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = normalizeWhitespace(headerMatch[2]!);

    if (/^[\d０-９]+番$/.test(normalizeDigits(header))) {
      return { speakerName: null, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (header === suffix || header.endsWith(suffix)) {
        const name = header.length > suffix.length ? header.slice(0, -suffix.length) : null;
        return {
          speakerName: name ? normalizeWhitespace(name).replace(/\s+/g, "") : null,
          speakerRole: suffix,
          content,
        };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";

  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }

  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const speakerHeaderPattern = String.raw`(?:[○◯◎●]\s*)?(?:[\d０-９]+番|[^○◯◎●。．、,，:：;；!?！？()（）]{0,20}?(?:副委員長|委員長|副議長|議長|議会事務局長|事務局長|課長事務取扱|担当課長|会計管理者|副町長|町長|教育長|副部長|部長|副課長|課長|室長|局長|係長|参事|主幹|次長|主査|補佐|主任|議員|委員))[（(][^()（）]{1,30}(?:君|様|議員|さん)[）)]`;
  const speechPattern = new RegExp(
    `${speakerHeaderPattern}[\\s\\S]*?(?=${speakerHeaderPattern}|$)`,
    "g",
  );
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const match of text.matchAll(speechPattern)) {
    const trimmed = match[0].trim();
    if (!trimmed) continue;

    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) continue;

    const normalized = normalizeWhitespace(trimmed);
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;

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

export function extractHeldOn(text: string): string | null {
  const head = normalizeWhitespace(text.slice(0, 1000));

  const directDate = parseJapaneseDate(head);
  if (directDate) return directDate;

  const summonMatch = head.match(
    /招\s*集\s*年\s*月\s*日\s*((?:令和|平成|昭和)\s*(?:元|\d+)\s*年\s*\d+\s*月\s*\d+\s*日)/,
  );
  if (summonMatch) {
    return parseJapaneseDate(summonMatch[1]!);
  }

  return null;
}

export function extractTitle(text: string, fallbackTitle: string): string {
  const head = normalizeWhitespace(text.slice(0, 500));

  const match = head.match(
    /((?:令和|平成|昭和)\s*(?:元|\d+)\s*年第\s*\d+回(?:\s*（\s*(?:定例会|臨時会)\s*）|\s*(?:定例会|臨時会))\s*笠置町議会\s*会議録(?:\s*（第\s*\d+号）)?)/,
  );
  if (!match) return fallbackTitle;

  return match[1]!.replace(/\s+/g, " ").trim();
}

function inferHeldOnFromPdfUrl(pdfUrl: string, title: string): string | null {
  const yearMatch = normalizeDigits(title).match(/(令和|平成|昭和)\s*(元|\d+)年/);
  if (!yearMatch) return null;

  const westernYear = parseJapaneseDate(`${yearMatch[1]}${yearMatch[2]}年1月1日`)?.slice(0, 4);
  if (!westernYear) return null;

  const fileName = new URL(pdfUrl).pathname.split("/").pop() ?? "";
  const fileMatch = fileName.match(/^(\d{2})(\d{2})\.pdf$/i);
  if (!fileMatch) return null;

  const month = Number(fileMatch[1]);
  const day = Number(fileMatch[2]);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[263648-kasagi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: KasagiMeetingRecord,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOn(text) ?? inferHeldOnFromPdfUrl(meeting.pdfUrl, meeting.title);
  if (!heldOn) {
    console.warn(`[263648-kasagi] 開催日の抽出失敗: ${meeting.pdfUrl}`);
    return null;
  }

  const frmId = new URL(meeting.detailPageUrl).searchParams.get("frmId");
  const fileBase = new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "");
  const externalId = frmId && fileBase ? `kasagi_${frmId}_${fileBase}` : null;
  const fallbackTitle = meeting.linkLabel ? `${meeting.title} ${meeting.linkLabel}` : meeting.title;

  return {
    municipalityCode,
    title: extractTitle(text, fallbackTitle),
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
