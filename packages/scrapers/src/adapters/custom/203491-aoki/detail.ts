/**
 * 青木村議会 -- detail フェーズ
 *
 * PDF は `○議長（氏名君）` のような話者マーカーを使う。
 * `◎会期決定` などの議事項目見出しは発言ではないため除外する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary } from "./shared";

export interface AokiDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: "plenary" | "committee" | "extraordinary";
}

const ROLE_SUFFIXES = [
  "議会運営委員長",
  "総務建設産業委員長",
  "社会文教委員長",
  "特別委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
  "副教育長",
  "教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "会計管理者",
  "代表監査委員",
  "監査委員",
  "副部長",
  "部長",
  "副課長",
  "課長補佐",
  "課長",
  "係長",
  "園長",
  "所長",
  "室長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "会計管理者",
  "代表監査委員",
  "監査委員",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "係長",
  "園長",
  "所長",
  "室長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

function cleanContent(text: string): string {
  return text
    .replace(/\u000c/g, " ")
    .replace(/[－―-]\s*\d+\s*[－―-]/g, " ")
    .replace(/[─━]{3,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/以上会議のてん末を記載し[\s\S]*$/, "")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "").trim();
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.replace(/[\s\u3000]+/g, "").trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = cleanContent(match[3] ?? "");

    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return {
      speakerName: rawName,
      speakerRole: rolePart || null,
      content,
    };
  }

  return {
    speakerName: null,
    speakerRole: null,
    content: cleanContent(stripped),
  };
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
    speakerRole === "議会運営委員長" ||
    speakerRole === "総務建設産業委員長" ||
    speakerRole === "社会文教委員長"
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = text.replace(/\u000c/g, "\n");
  const firstSpeakerIndex = normalized.search(
    /[○◯〇][^（()\n]{1,30}[（(][^）)\n]+?(?:君|様|議員)[）)]/,
  );
  const bodyText =
    firstSpeakerIndex >= 0 ? normalized.slice(firstSpeakerIndex) : normalized;
  const blocks = bodyText.split(/(?=[○◯〇◎●])/);

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇◎●]/.test(trimmed)) continue;
    if (/^◎/.test(trimmed)) continue;
    if (/^[○◯〇◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]\s*$/.test(trimmed)) {
      continue;
    }

    const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
    if ((!speakerName && !speakerRole) || !content) continue;

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

    const { extractText, getDocumentProxy } = await import("../../../utils/pdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[203491-aoki] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function buildMeetingData(
  params: AokiDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `aoki_${heldOn}_${params.title}`,
    statements,
  };
}
