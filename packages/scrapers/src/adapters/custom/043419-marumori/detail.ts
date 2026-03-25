/**
 * 丸森町議会 -- detail フェーズ
 *
 * 議決結果 PDF をダウンロードしてテキストを抽出し、ParsedStatement 配列を生成する。
 *
 * 丸森町議会は会議録本文（発言録）を公開しておらず、公開されているのは議決結果 PDF のみ。
 * PDF 内容は「議案名・議決結果の一覧表」であり、発言者情報は含まれない。
 * そのため、PDF テキストの各行を remark として保存する。
 *
 * PDF 作成ツール: Antenna House PDF Driver（テキスト埋め込み PDF）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, toHalfWidth } from "./shared";

export interface MarumoriDetailParams {
  /** 会議タイトル */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催年（西暦）*/
  year: number;
  /** 開催日文字列（例: "1月27日"） */
  dateText: string;
}

/**
 * PDF テキストから開催日を抽出する。
 * dateText（例: "1月27日", "2月14日～2月22日"）と year から YYYY-MM-DD を生成する。
 * 範囲指定の場合は開始日を使用する。
 */
export function extractHeldOn(
  dateText: string,
  year: number,
): string | null {
  const normalized = toHalfWidth(dateText);

  // 開始日を取得（"M月D日" パターン）
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF テキストを行単位で ParsedStatement 配列に変換する。
 *
 * 丸森町の議決結果 PDF には発言者情報がなく、議案名と議決結果の一覧表のみ。
 * 各行を remark として保存する。空行・ページ番号・ヘッダー行はスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split(/\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ページ番号のみの行をスキップ（例: "1", "2"）
    if (/^\d+$/.test(trimmed)) continue;

    // 短すぎる行をスキップ
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
      `[043419-marumori] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 */
export async function buildMeetingData(
  params: MarumoriDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const pdfText = await fetchPdfText(params.pdfUrl);
  if (!pdfText) return null;

  const heldOn = extractHeldOn(params.dateText, params.year);
  if (!heldOn) return null;

  const statements = parseStatements(pdfText);
  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `marumori_${params.title}`,
    statements,
  };
}
