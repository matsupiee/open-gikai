/**
 * 藤里町議会 -- detail フェーズ
 *
 * 公開されている PDF は発言録ではなく議案・会議結果の一覧表であるため、
 * 抽出したテキストを行単位の remark として保存する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractExternalId, fetchBinary } from "./shared";

export interface FujisatoDetailParams {
  title: string;
  pdfUrl: string;
  heldOn: string;
  meetingType: string;
}

/**
 * PDF テキストを行単位の remark に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const normalizedText = text
    .replace(/\r/g, "")
    .replace(/】\s*(?=(?:発|議|報|認|選|請|陳))/g, "】\n")
    .replace(
      /\s+(?=(?:発\s*議|議\s*案|報\s*告|認\s*定|選\s*挙|請\s*願|陳\s*情)\s*第\s*[０-９\d]+)/g,
      "\n",
    );

  for (const line of normalizedText.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (trimmed.length < 5) continue;

    const contentHash = createHash("sha256").update(trimmed).digest("hex");
    const startOffset = offset;
    const endOffset = offset + trimmed.length;

    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content: trimmed,
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
      `[053465-fujisato] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export async function buildMeetingData(
  params: FujisatoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const pdfText = await fetchPdfText(params.pdfUrl);
  if (!pdfText) return null;

  const statements = parseStatements(pdfText);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: extractExternalId(new URL(params.pdfUrl).pathname),
    statements,
  };
}
