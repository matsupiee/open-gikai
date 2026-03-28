/**
 * 東みよし町議会 — detail フェーズ
 *
 * 東みよし町は会議録全文ではなく「議会だより」PDF を公開している。
 * 新しい号には画像ベース PDF が含まれるため、pdftotext を優先して抽出し、
 * 取得できたテキストを行単位の remark として格納する。
 */

import { createHash } from "node:crypto";
import { extractPdfText } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HigashimiyoshiIssue } from "./list";
import {
  detectMeetingType,
  fetchBinary,
  normalizeFullWidth,
} from "./shared";

const NOISE_PATTERNS = [
  /^東みよし町議会だより$/,
  /^ふるさと東みよし町$/,
  /^元気・交流・未来へ$/,
  /^まちの考えを問う$/,
  /^いっぱんしつもん\s+一般質問$/,
  /^一般質問$/,
  /^委員会審議$/,
  /^委員会のうごき$/,
  /^視察研修報告$/,
  /^第\d+号$/,
  /^\d+$/,
];

/**
 * pdftotext の出力を整形し、内容のある行だけを抽出する。
 * 2 段組 PDF では大きな空白で列が分かれるため、その位置で分割する。
 */
export function extractRemarkLines(text: string): string[] {
  const lines: string[] = [];

  for (const rawLine of text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").split(/\f|\n/)) {
    const segments = rawLine
      .split(/\s{12,}/)
      .map((segment) => normalizeFullWidth(segment).replace(/\s+/g, " ").trim())
      .filter((segment) => segment.length >= 8);

    for (const segment of segments) {
      if (NOISE_PATTERNS.some((pattern) => pattern.test(segment))) continue;
      if (/^[0-9\-/.:() ]+$/.test(segment)) continue;
      lines.push(segment);
    }
  }

  return lines;
}

/** 抽出済みテキストを ParsedStatement 配列に変換する。 */
export function parseStatements(text: string): ParsedStatement[] {
  const lines = extractRemarkLines(text);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const line of lines) {
    const contentHash = createHash("sha256").update(line).digest("hex");
    const startOffset = offset;
    const endOffset = offset + line.length;

    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content: line,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  return extractPdfText(buffer, {
    pdfUrl,
    strategy: ["pdftotext", "unpdf"],
    tempPrefix: "higashimiyoshi",
  });
}

function buildExternalId(issue: HigashimiyoshiIssue): string | null {
  if (issue.issueNumber !== null) {
    return `higashimiyoshi_${issue.issueNumber}`;
  }

  const fileName = issue.pdfUrl.match(/\/([^/]+)\.pdf$/i)?.[1] ?? null;
  return fileName ? `higashimiyoshi_${fileName}` : null;
}

/** PDF をダウンロードして MeetingData を組み立てる。 */
export async function fetchMeetingData(
  issue: HigashimiyoshiIssue,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(issue.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: issue.title,
    meetingType: detectMeetingType(issue.title),
    heldOn: issue.heldOn,
    sourceUrl: issue.pdfUrl,
    externalId: buildExternalId(issue),
    statements,
  };
}
