/**
 * 日野町議会（滋賀県）— detail フェーズ
 *
 * 日野町の PDF は `○` マーカーではなく、
 * `議長（氏名君）` のような見出しで発言者が始まる。
 * そのため見出しパターンで発言ブロックを分割する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface HinoShigaDetailParams {
  sessionTitle: string;
  pdfUrl: string;
  linkText: string;
  meetingType: string;
  heldOn: string | null;
  detailPageUrl: string;
}

const ROLE_SUFFIXES = [
  "会計管理者",
  "事務局長",
  "担当課長",
  "課長補佐",
  "副委員長",
  "副町長",
  "副議長",
  "政策参与",
  "主席参事",
  "委員長",
  "教育長",
  "副部長",
  "副課長",
  "管理者",
  "議長",
  "町長",
  "議員",
  "委員",
  "参与",
  "主監",
  "次長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "館長",
];

const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "政策参与",
  "参与",
  "主監",
  "次長",
  "部長",
  "副部長",
  "課長",
  "担当課長",
  "副課長",
  "課長補佐",
  "室長",
  "局長",
  "係長",
  "参事",
  "主席参事",
  "主幹",
  "主査",
  "補佐",
  "館長",
  "管理者",
  "会計管理者",
  "事務局長",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ROLE_PATTERN = ROLE_SUFFIXES.map(escapeRegExp).join("|");
const SPEAKER_HEADER_PATTERN = new RegExp(
  `(?:${ROLE_PATTERN}|[^\\s()]{1,24}(?:${ROLE_PATTERN})|(?:[\\d０-９]+|[一二三四五六七八九十]+)番)[（(][^）)]{1,20}(?:君|様)[）)]`,
  "gu",
);

function normalizeExtractedText(text: string): string {
  const overviewIndex = text.indexOf("会議の概要");
  const source = overviewIndex >= 0 ? text.slice(overviewIndex + "会議の概要".length) : text;

  return source
    .replace(/\b\d+-\d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)$/,
  );
  if (!match) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const rolePart = match[1]!.replace(/[\s　]+/g, "").trim();
  const speakerName = match[2]!.replace(/[\s　]+/g, "").trim();
  const content = match[3]!.trim();

  if (/^[\d０-９一二三四五六七八九十]+番$/.test(rolePart)) {
    return { speakerName, speakerRole: "議員", content };
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return { speakerName, speakerRole: suffix, content };
    }
  }

  return { speakerName, speakerRole: rolePart || null, content };
}

export function classifyKind(
  speakerRole: string | null,
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
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizeExtractedText(text);
  const matches = [...normalized.matchAll(SPEAKER_HEADER_PATTERN)];
  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const start = match.index!;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : normalized.length;
    const header = match[0]!;
    const contentText = normalized.slice(start + header.length, end).trim();
    const block = `${header} ${contentText}`.trim();
    const { speakerName, speakerRole, content } = parseSpeaker(block);
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
  } catch (err) {
    console.warn(
      `[253839-hino-shiga] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function buildMeetingData(
  params: HinoShigaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const articleIdMatch = params.detailPageUrl.match(/(\d{7,10})\.html/);
  const articleId = articleIdMatch?.[1] ?? "unknown";
  const fileName = (params.pdfUrl.split("/").pop() ?? params.pdfUrl).replace(/\.pdf$/i, "");
  const externalId = `hino_shiga_${articleId}_${fileName}`;

  return {
    municipalityCode,
    title: `${params.sessionTitle} ${params.linkText}`.trim(),
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
