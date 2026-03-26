/**
 * 外ヶ浜町議会 — detail フェーズ
 *
 * 議会だより PDF をダウンロードしてテキストを抽出し、
 * 段落単位で ParsedStatement に変換する。
 *
 * 外ヶ浜町は会議録のオンライン公開がないため、
 * 「議会だより」（PDF）のテキストを段落単位で格納する。
 * 発言者特定が困難なため、段落単位の remark として格納する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { SotogahamaDocument } from "./list";
import { fetchBinary } from "./shared";

/**
 * PDF テキストを段落に分割し、ParsedStatement 配列を生成する。
 *
 * 空行または改行 2 つ以上で段落を区切る。
 * 短すぎる段落（10 文字未満）はスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 10);

  for (const paragraph of paragraphs) {
    const contentHash = createHash("sha256").update(paragraph).digest("hex");
    const startOffset = offset;
    const endOffset = offset + paragraph.length;

    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content: paragraph,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

/**
 * PDF URL からテキストを取得する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[023078-sotogahama] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  doc: SotogahamaDocument,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (!doc.heldOn) return null;

  const text = await fetchPdfText(doc.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const externalId = `sotogahama_${doc.filename}`;

  const title =
    doc.type === "dayori"
      ? `外ヶ浜町議会だより ${doc.issue ?? doc.filename}`
      : `外ヶ浜町議会一般質問通告表 ${doc.filename}`;

  return {
    municipalityCode,
    title,
    meetingType: "plenary",
    heldOn: doc.heldOn,
    sourceUrl: doc.pdfUrl,
    externalId,
    statements,
  };
}
