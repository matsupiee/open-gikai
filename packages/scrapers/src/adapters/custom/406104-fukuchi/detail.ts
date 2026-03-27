/**
 * 福智町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FukuchiMeeting } from "./list";
import { detectMeetingType, eraToWesternYear, fetchBinary } from "./shared";

const ROLE_SUFFIXES = [
  "会計管理者兼出納室長",
  "議会事務局長",
  "診療所事務長",
  "まちづくり総合政策課長",
  "防災管理・管財課長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副教育長",
  "教育長",
  "会計管理者",
  "事務局長",
  "出納室長",
  "副部長",
  "副課長",
  "町長",
  "議員",
  "委員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "会計管理者兼出納室長",
  "会計管理者",
  "出納室長",
  "診療所事務長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

function cleanSpeakerName(text: string): string {
  return text
    .replace(/^[\d０-９]+番[\s　]*/, "")
    .replace(/(?:君|様|議員)$/, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  const match = stripped.match(
    /^(.+?)[（(]([^）)]+?)(?:君|様)?[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const innerText = match[2]!.trim();
    const content = match[3]!.trim();

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return {
        speakerName: cleanSpeakerName(innerText),
        speakerRole: "議員",
        content,
      };
    }

    if (rolePart === "議員") {
      return {
        speakerName: cleanSpeakerName(innerText),
        speakerRole: "議員",
        content,
      };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return {
          speakerName: cleanSpeakerName(innerText),
          speakerRole: suffix,
          content,
        };
      }
    }

    return {
      speakerName: cleanSpeakerName(innerText),
      speakerRole: rolePart || null,
      content,
    };
  }

  const headerMatch = stripped.match(/^([^\s　]{1,40})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const speakerName =
          header.length > suffix.length
            ? cleanSpeakerName(header.slice(0, -suffix.length))
            : null;
        return { speakerName, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

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
    speakerRole === "議会事務局長" ||
    speakerRole === "事務局長"
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) {
      continue;
    }

    const normalized = trimmed
      .replace(/[ \t　]+/g, " ")
      .replace(/\n+/g, " ")
      .trim();
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
  const match = text.match(
    /(令和|平成)(元|[0-9０-９]+)年\s*([0-9０-９]+)月\s*([0-9０-９]+)日/,
  );
  if (!match) return null;

  const westernYear = eraToWesternYear(`${match[1]}${toHalfWidth(match[2]!)}年`);
  if (!westernYear) return null;

  const month = Number(toHalfWidth(match[3]!));
  const day = Number(toHalfWidth(match[4]!));
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[406104-fukuchi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `fukuchi_${match[1]}`;
}

export async function fetchMeetingData(
  meeting: FukuchiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOn(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: buildExternalId(meeting.pdfUrl),
    statements,
  };
}
