import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  detectMeetingType,
  extractExternalIdKey,
  fetchBinary,
} from "./shared";
import type { HaebaruMeeting } from "./list";

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "会計管理者",
  "事務局長",
  "副局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "館長",
  "所長",
  "参事監",
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
  "会計管理者",
  "事務局長",
  "副局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "館長",
  "所長",
  "参事監",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "係長",
]);

function cleanupContent(text: string): string {
  return text
    .replace(/〔[^〕]*(?:登壇|退席|退場|着席|降壇)[^〕]*〕/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "").trim();
  const normalized = stripped.replace(/\s+/g, " ");
  const match = normalized.match(/^(.+?)\s+(.+?)(さん|君|議員)\s+([\s\S]*)$/);

  if (match) {
    const rolePart = match[1]?.trim() ?? "";
    const speakerName = (match[2] ?? "").replace(/\s+/g, "") || null;
    const content = cleanupContent(match[4] ?? "");

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName, speakerRole: suffix, content };
      }
    }

    return { speakerName, speakerRole: rolePart || null, content };
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: cleanupContent(stripped),
  };
}

export function classifyKind(
  speakerRole: string | null
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  ) {
    return "remark";
  }
  if (speakerRole === "議員") return "question";
  for (const role of ANSWER_ROLES) {
    if (speakerRole === role || speakerRole.endsWith(role)) {
      return "answer";
    }
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

    const normalized = trimmed.replace(/\s+/g, " ");
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

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (e) {
    console.warn(
      `[473502-haebaru] fetchPdfText error: ${pdfUrl}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: HaebaruMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const externalIdKey = extractExternalIdKey(meeting.pdfUrl);

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.sessionTitle),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId: externalIdKey ? `haebaru_${externalIdKey}` : null,
    statements,
  };
}
