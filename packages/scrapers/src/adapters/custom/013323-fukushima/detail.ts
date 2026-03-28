import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FukushimaMeeting } from "./list";
import {
  fetchBinary,
  normalizeSpaces,
  toHalfWidth,
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
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "副室長",
  "室長",
  "副所長",
  "所長",
  "会計管理者",
  "監査委員",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "係長",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "副室長",
  "所長",
  "副所長",
  "局長",
  "事務局長",
  "会計管理者",
  "監査委員",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "係長",
]);

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SPEAKER_BLOCK_PATTERN = new RegExp(
  `^[○◯〇◎●]\\s*(?:[\\d０-９]+番|[^\\s（）()]{0,20}(?:${ROLE_SUFFIXES.map(escapeRegex).join("|")}))[（(][^）)]{1,20}(?:君|様|議員)?[）)]`,
);

const NON_SPEECH_HEADINGS = [
  "出席議員",
  "欠席議員",
  "出席委員",
  "欠席委員",
  "出席説明員",
  "職務のため議場に出席した議会事務局職員",
];

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "").trim();

  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)?[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

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
    const content = headerMatch[2]!.trim();

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

  return { speakerName: null, speakerRole: null, content: stripped };
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
    speakerRole === "副委員長"
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

export function extractHeldOnFromText(text: string): string | null {
  const normalized = toHalfWidth(normalizeSpaces(text));
  const match = normalized.match(
    /(令和|平成)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  const westernYear = era === "令和" ? eraYear + 2018 : eraYear + 1988;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseStatements(rawText: string): ParsedStatement[] {
  const text = normalizeSpaces(rawText);
  const blocks = text.split(/(?=[○◯〇◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇◎●]/.test(trimmed)) continue;

    if (/^[○◯〇◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) {
      continue;
    }

    const normalized = trimmed.replace(/\s+/g, " ");
    if (!SPEAKER_BLOCK_PATTERN.test(normalized)) continue;
    if (
      NON_SPEECH_HEADINGS.some((heading) =>
        normalized.startsWith(`○${heading}`) ||
        normalized.startsWith(`◎${heading}`) ||
        normalized.startsWith(`〇${heading}`) ||
        normalized.startsWith(`◯${heading}`) ||
        normalized.startsWith(`●${heading}`),
      )
    ) {
      continue;
    }

    const parsed = parseSpeaker(normalized);
    const content = parsed.content
      .replace(/^[（(].+?(?:登壇|退席|退場|着席)[）)]\s*/, "")
      .trim();

    if (!content) continue;
    if (!parsed.speakerName && !parsed.speakerRole) continue;

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

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[013323-fukushima] PDF fetch failed: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildExternalId(pdfUrl: string): string {
  const filename =
    new URL(pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? pdfUrl;
  return `fukushima_${filename}`;
}

export async function fetchMeetingData(
  meeting: FukushimaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: extractHeldOnFromText(text) ?? meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: buildExternalId(meeting.pdfUrl),
    statements,
  };
}
