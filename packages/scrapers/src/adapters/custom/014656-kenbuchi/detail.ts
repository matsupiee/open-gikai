/**
 * 剣淵町議会 会議録（議決結果）-- detail フェーズ
 *
 * 議決結果 PDF から議案一覧を抽出し、remark statement として返す。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KenbuchiMeeting } from "./list";
import { compactJapaneseText, fetchBinary, parseEraDate, toHalfWidth } from "./shared";

export interface KenbuchiBill {
  identifier: string;
  title: string;
  result: string;
  resolvedOn: string;
}

const RESULT_PATTERN = [
  "原案可決",
  "承認",
  "同意",
  "可決",
  "否決",
  "採択",
  "不採択",
  "継続審査",
] as const;

export function extractHeldOn(year: number, dateText: string): string | null {
  const normalized = compactJapaneseText(dateText);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = Number(match[1]!);
  const day = Number(match[2]!);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizePdfText(text: string): string {
  return toHalfWidth(text)
    .replace(/[\u3000\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLabel(value: string): string {
  return compactJapaneseText(value);
}

function normalizeResult(value: string): string {
  return compactJapaneseText(value);
}

export function parseBills(text: string): KenbuchiBill[] {
  const normalized = normalizePdfText(text);
  const body = normalized.replace(/^.*?(?=(?:議\s*案|報\s*告|発\s*議)\s*第\s*[0-9]+\s*号)/, "");

  const resultAlternation = RESULT_PATTERN.map((result) => result.split("").join("\\s*")).join("|");
  const pattern = new RegExp(
    `((?:議\\s*案|報\\s*告|発\\s*議))\\s*第\\s*(\\d+)\\s*号\\s+([\\s\\S]+?)\\s+((?:令和|平成)\\s*(?:元|\\d+)\\s*年\\s*\\d+\\s*月\\s*\\d+\\s*日)\\s+(${resultAlternation})`,
    "g",
  );

  const bills: KenbuchiBill[] = [];
  const seen = new Set<string>();

  for (const match of body.matchAll(pattern)) {
    const label = compactLabel(match[1]!);
    const number = Number(match[2]!);
    const title = compactJapaneseText(match[3]!);
    const resolvedOn = parseEraDate(match[4]!);
    const result = normalizeResult(match[5]!);

    if (!Number.isFinite(number) || !title || !resolvedOn || !result) continue;

    const identifier = `${label}第${number}号`;
    const key = `${identifier}|${title}|${result}|${resolvedOn}`;
    if (seen.has(key)) continue;
    seen.add(key);

    bills.push({
      identifier,
      title,
      result,
      resolvedOn,
    });
  }

  return bills;
}

export function buildStatements(bills: KenbuchiBill[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const bill of bills) {
    const content = `${bill.identifier} ${bill.title} ${bill.result}`;
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
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
  } catch (error) {
    console.warn(
      `[014656-kenbuchi] PDF 取得失敗: ${pdfUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchMeetingData(
  meeting: KenbuchiMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = buildStatements(parseBills(text));
  if (statements.length === 0) return null;

  const heldOn = extractHeldOn(meeting.year, meeting.dateText);
  if (!heldOn) return null;

  const pathMatch = meeting.pdfUrl.match(/\/wp-content\/uploads\/([^?#]+)\.pdf$/i);
  const externalId = pathMatch
    ? `kenbuchi_${pathMatch[1]!.replace(/\//g, "_")}`
    : `kenbuchi_${createHash("sha256").update(meeting.pdfUrl).digest("hex").slice(0, 16)}`;

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
