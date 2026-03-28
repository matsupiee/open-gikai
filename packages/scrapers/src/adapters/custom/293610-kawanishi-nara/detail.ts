import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary, normalizeDigits, parseDateText } from "./shared";
import type { KawanishiMeetingType } from "./shared";

export interface KawanishiDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: KawanishiMeetingType;
  pageUrl: string;
  linkLabel: string;
}

const ROLE_SUFFIXES = [
  "議会運営副委員長",
  "議会運営委員長",
  "総務特別参事",
  "まちづくり推進理事",
  "まちマネジメント担当理事",
  "住民保険担当理事",
  "行政改革統括理事",
  "まちづくり推進担当理事",
  "議会事務局長心得",
  "副委員長",
  "委員長",
  "副議長",
  "監査委員",
  "会計管理者",
  "事務局長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "理事",
  "参事",
  "課長",
  "室長",
  "係長",
  "主幹",
  "主査",
  "補佐",
  "議員",
] as const;

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "理事",
  "参事",
  "課長",
  "室長",
  "係長",
  "主幹",
  "主査",
  "補佐",
  "会計管理者",
  "監査委員",
  "事務局長",
  "議会事務局長心得",
]);

function normalizeRoleText(text: string): string {
  return normalizeDigits(text).replace(/[\s　]+/g, "");
}

function cleanupContent(text: string): string {
  return normalizeDigits(text)
    .replace(/\u000c/g, " ")
    .replace(/\s*-\s*\d+\s*-\s*/g, " ")
    .replace(/\s+([、。])\s*/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●〇]\s*/, "").trim();

  const bracketMatch = stripped.match(
    /^(.+?)[（(]([^）)]+?)(?:議員|君|様)?[）)]\s*([\s\S]*)$/,
  );
  if (bracketMatch) {
    const rolePart = normalizeRoleText(bracketMatch[1] ?? "");
    const rawName = normalizeRoleText(bracketMatch[2] ?? "").replace(/議員$/, "");
    const content = cleanupContent(bracketMatch[3] ?? "");

    if (/^[\d０-９]+番(?:議員)?$/.test(rolePart)) {
      return {
        speakerName: rawName || null,
        speakerRole: "議員",
        content,
      };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return {
          speakerName: rawName || null,
          speakerRole: suffix,
          content,
        };
      }
    }

    return {
      speakerName: rawName || null,
      speakerRole: rolePart || null,
      content,
    };
  }

  const compact = normalizeRoleText(stripped);

  if (/^[\d０-９]+番(?:議員)?/.test(compact)) {
    const roleMatch = compact.match(/^([\d０-９]+番(?:議員)?)([\s\S]*)$/);
    if (roleMatch) {
      return {
        speakerName: null,
        speakerRole: "議員",
        content: cleanupContent(roleMatch[2] ?? ""),
      };
    }
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (compact.startsWith(suffix)) {
      return {
        speakerName: null,
        speakerRole: suffix,
        content: cleanupContent(compact.slice(suffix.length)),
      };
    }
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: cleanupContent(stripped),
  };
}

export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長" ||
    speakerRole === "議会運営委員長" ||
    speakerRole === "議会運営副委員長"
  ) {
    return "remark";
  }
  if (speakerRole === "議員") return "question";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";

  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }

  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizeDigits(text)
    .replace(/\u000c/g, " ")
    .replace(/\s*-\s*\d+\s*-\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/地方自治法第123条第2項の規定により、ここに署名する。[\s\S]*$/, "")
    .replace(/（議決の結果）[\s\S]*$/, "")
    .trim();

  const blocks = normalized.split(/(?=[○◯◎●〇])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●〇]/.test(trimmed)) continue;
    if (/^[○◯◎●〇]\s*[（(].+?(登壇|退席|退場|着席|挨拶|報告|説明)[）)]/.test(trimmed)) {
      continue;
    }

    const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
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
  return parseDateText(normalizeDigits(text).slice(0, 2_000));
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
      `[293610-kawanishi-nara] PDF 取得失敗: ${pdfUrl}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function buildMeetingData(
  params: KawanishiDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = params.heldOn ?? extractHeldOn(text);
  if (!heldOn) {
    console.warn(`[293610-kawanishi-nara] 開催日の抽出失敗: ${params.pdfUrl}`);
    return null;
  }

  const fileName = params.pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? "unknown";
  const externalId = `kawanishi_nara_${fileName}`;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType ?? detectMeetingType(params.title || params.linkLabel),
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
