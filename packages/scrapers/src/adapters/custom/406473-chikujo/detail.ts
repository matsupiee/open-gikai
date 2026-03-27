/**
 * 築上町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface ChikujoDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
  pageUrl: string;
}

const ROLE_SUFFIXES = [
  "農業委員会事務局長",
  "議会事務局長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副教育長",
  "教育長",
  "会計管理者",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "管理者",
  "町長",
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
  "管理者",
]);

function normalizeSpeakerName(rawName: string): string {
  return rawName
    .replace(/^[\d０-９]+番[\s　]*/u, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");
  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/u);

  if (match) {
    const rolePart = match[1]!.replace(/\s+/g, " ").trim();
    const rawName = normalizeSpeakerName(match[2]!);
    const content = match[3]!.trim();

    if (/^[\d０-９]+番$/u.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return {
      speakerName: rawName || null,
      speakerRole: rolePart || null,
      content,
    };
  }

  const headerMatch = stripped.match(/^([^\s　]{1,40})[\s　]+([\s\S]*)/u);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header === suffix || header.endsWith(suffix)) {
        const speakerName =
          header.length > suffix.length ? header.slice(0, -suffix.length) : null;
        return { speakerName, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
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

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/u);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/u.test(trimmed)) continue;

    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/u.test(trimmed)) {
      continue;
    }

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
  } catch (err) {
    console.warn(
      `[406473-chikujo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

function buildExternalId(pdfUrl: string): string {
  const normalized = new URL(pdfUrl).pathname
    .replace(/\.pdf$/i, "")
    .replace(/^\/+/, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `chikujo_${normalized}`;
}

export async function fetchMeetingData(
  params: ChikujoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: buildExternalId(params.pdfUrl),
    statements,
  };
}
