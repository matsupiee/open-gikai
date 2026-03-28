import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KasuyaMeeting } from "./list";
import { fetchBinary, parseWarekiDate, toHalfWidth } from "./shared";

const ROLE_SUFFIXES = [
  "議会運営委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "教育委員会次長",
  "副教育長",
  "教育長",
  "議会局長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "係長",
  "所長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

const ANSWER_ROLE_SUFFIXES = [
  "副町長",
  "町長",
  "教育委員会次長",
  "副教育長",
  "教育長",
  "議会局長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "係長",
  "所長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
] as const;

const ROLE_PATTERN = ROLE_SUFFIXES.join("|");

function normalizePdfText(text: string): string {
  return toHalfWidth(text)
    .replace(/－\s*\d+\s*－/g, " ")
    .replace(/\(\s*(?:開会|閉会)[^)]+\)/g, " ")
    .replace(/（\s*(?:開会|閉会)[^）]+）/g, " ")
    .replace(
      /[（(][^）)]{0,80}(?:登壇|退席|退場|着席|発言席前へ|議長席へ|自席へ)[^）)]*[）)]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");
  const numberedSpeakerMatch = stripped.match(
    /^([\d０-９]+番)\s+(.+?)(?:君|様|議員)\s+([\s\S]*)$/,
  );
  if (numberedSpeakerMatch) {
    return {
      speakerName: numberedSpeakerMatch[2]!.replace(/\s+/g, "").trim(),
      speakerRole: "議員",
      content: numberedSpeakerMatch[3]!.trim(),
    };
  }

  const spacedMatch = stripped.match(
    new RegExp(`^(.*?(?:${ROLE_PATTERN}))\\s+(.+?)(?:君|様|議員)\\s+([\\s\\S]*)$`),
  );
  if (spacedMatch) {
    let rolePart = spacedMatch[1]!.replace(/\s+/g, "").trim();
    const speakerName = spacedMatch[2]!.replace(/\s+/g, "").trim();
    const content = spacedMatch[3]!.trim();

    if (rolePart === "臨時議長") rolePart = "議長";

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName, speakerRole: rolePart, content };
      }
    }

    return { speakerName, speakerRole: rolePart || null, content };
  }

  const match = stripped.match(
    /^(.+?)[（(]([^）)]+?)(?:君|様|議員)?[）)]\s*([\s\S]*)$/,
  );

  if (match) {
    let rolePart = match[1]!.replace(/\s+/g, "").trim();
    const speakerName = match[2]!.replace(/\s+/g, "").trim();
    const content = match[3]!.trim();

    if (rolePart === "臨時議長") rolePart = "議長";

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName, speakerRole: rolePart, content };
      }
    }

    return { speakerName, speakerRole: rolePart || null, content };
  }

  const fallbackMatch = stripped.match(/^([^\s　]{1,40})[\s　]+([\s\S]*)$/);
  if (fallbackMatch) {
    const header = fallbackMatch[1]!.replace(/\s+/g, "");
    const content = fallbackMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        return {
          speakerName: header.length > suffix.length ? header.slice(0, -suffix.length) : null,
          speakerRole: header,
          content,
        };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";

  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole.endsWith("委員長") ||
    speakerRole === "議会局長" ||
    speakerRole === "事務局長"
  ) {
    return "remark";
  }

  for (const suffix of ANSWER_ROLE_SUFFIXES) {
    if (speakerRole === suffix || speakerRole.endsWith(suffix)) {
      return "answer";
    }
  }

  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalizedText = normalizePdfText(text);
  const blocks = normalizedText.split(/(?=[○◯〇◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇◎●]/.test(trimmed)) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
    if (!content) continue;

    const normalizedContent = content.replace(/\s+/g, " ").trim();
    if (!normalizedContent) continue;

    const contentHash = createHash("sha256")
      .update(normalizedContent)
      .digest("hex");
    const startOffset = offset;
    const endOffset = offset + normalizedContent.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: normalizedContent,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

export function extractHeldOn(text: string): string | null {
  return parseWarekiDate(text);
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    console.warn(
      `[403491-kasuya] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: KasuyaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOn(text);
  if (!heldOn) return null;

  const fileMatch = meeting.pdfUrl.match(/\/([^/]+)\.pdf$/i);
  const externalId = fileMatch ? `kasuya_${fileMatch[1]}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
