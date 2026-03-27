/**
 * 朝日村議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、話者ヘッダーごとに発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（小林弘之君） 皆さん、おはようございます。
 *   ○村長（小林弘幸君） お答えいたします。
 *   ○１０番（清沢敬子君） 本日は２問の質問をさせていただきます。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, normalizePdfText, toHankaku } from "./shared";

export interface AsahiNaganoDetailParams {
  title: string;
  year: number;
  pdfUrl: string;
  meetingType: string;
  yearPageUrl: string;
  sessionKey: string;
}

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
  "副教育長",
  "教育長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "副園長",
  "園長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "議員",
  "委員",
];

const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "園長",
  "副園長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
]);

export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  const match = stripped.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/);
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

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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

function buildHeaderPattern(): RegExp {
  const suffixPattern = ROLE_SUFFIXES.map((suffix) =>
    suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  ).join("|");

  return new RegExp(`○(?:[^（(\\s]*?(?:${suffixPattern})|[\\d０-９]+番)[（(][^）)]+[）)]`, "g");
}

function cleanStatementContent(content: string): string {
  return content
    .replace(/－\d+－/g, " ")
    .replace(/─+/g, " ")
    .replace(/〔[^〕]*(?:登壇|退席|退場|着席|一同)[^〕]*〕/g, " ")
    .replace(/[◎◇]\s*[^○◯◎●]*$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHeldOn(text: string): string | null {
  const normalized = toHankaku(text.slice(0, 1000));

  const openMatch = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日(?=開会|開議)/);
  const fallbackMatch =
    openMatch ?? normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);

  if (!fallbackMatch) return null;

  const era = fallbackMatch[1]!;
  const eraYear = fallbackMatch[2] === "元" ? 1 : parseInt(fallbackMatch[2]!, 10);
  const month = parseInt(fallbackMatch[3]!, 10);
  const day = parseInt(fallbackMatch[4]!, 10);

  const year = (era === "令和" ? 2018 : 1988) + eraYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseStatements(text: string): ParsedStatement[] {
  const headerPattern = buildHeaderPattern();
  const positions: number[] = [];

  let match: RegExpExecArray | null;
  while ((match = headerPattern.exec(text)) !== null) {
    positions.push(match.index);
  }

  if (positions.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]!;
    const end = positions[i + 1] ?? text.length;
    const block = text.slice(start, end).trim();
    if (!block) continue;

    const normalized = block.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!speakerName && !speakerRole) continue;

    const cleanedContent = cleanStatementContent(content);
    if (!cleanedContent) continue;

    const contentHash = createHash("sha256").update(cleanedContent).digest("hex");
    const startOffset = offset;
    const endOffset = offset + cleanedContent.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: cleanedContent,
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
    return normalizePdfText(text);
  } catch (err) {
    console.warn(
      `[204510-asahi-nagano] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function buildMeetingData(
  params: AsahiNaganoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOn(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: params.sessionKey,
    statements,
  };
}
