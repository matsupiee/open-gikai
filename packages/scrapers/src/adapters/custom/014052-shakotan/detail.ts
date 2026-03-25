/**
 * 積丹町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * 一般質問の質問者と議案情報を ParsedStatement として返す。
 *
 * 積丹町は「会議の結果」（逐語録ではなく概要）を PDF で公開している。
 *
 * PDF 構造例:
 *   令和７年第４回積丹町議会定例会の結果
 *   ■ 定例会日程
 *   令和７年１２月１６日（火）～令和７年１２月１８日（木）
 *
 *   一般質問
 *     移住・定住対策について          【岩本幹兒議員】
 *     独居高齢者対策について          【岩本幹兒議員】
 *     一連の熊騒動について            【田村雄一議員】
 *
 *   議案第１号  積丹町公告式条例の一部改正について  令和７年12月１６日  原案可決
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary, toHalfWidth } from "./shared";

export interface ShakotanDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  headingYear: number;
}

/**
 * 一般質問セクションから質問者と質問テーマを抽出する。
 *
 * PDF テキストは mergePages: true で抽出すると1行に結合される。
 *
 * パターン: {質問テーマ} 【{議員名}議員】
 * 例: "積丹町におけるＧＩＧＡスクール構想の推進と補完について 【 坂節子議員】"
 *
 * 「一般質問」キーワードの後から次のセクション（議案/●/報告）までの範囲を抽出し、
 * {テーマ} 【{議員名}議員】 のペアをパースする。
 */
export function parseQuestions(
  text: string,
): Array<{ speakerName: string; topic: string }> {
  const results: Array<{ speakerName: string; topic: string }> = [];

  const normalized = toHalfWidth(text);

  // 「一般質問」セクションを抽出する
  // 終了は議案 / ● / ■ / 報告 / 臨時会 などの次セクション開始まで
  const sectionPattern =
    /一般質問\s+([\s\S]+?)(?=\s*(?:議\s*案|報\s*告|●|◆|■|$))/g;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionPattern.exec(normalized)) !== null) {
    const sectionText = sectionMatch[1]!;

    // セクション内から「{テーマ} 【{議員名}議員】」ペアを繰り返し抽出
    // 【 スペース 氏名 議員】 のパターンに対応
    const itemPattern = /(.+?)\s*【\s*(.+?)議員】/g;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemPattern.exec(sectionText)) !== null) {
      const topicRaw = itemMatch[1]!.trim();
      const speakerName = itemMatch[2]!.replace(/\s+/g, "").trim();

      if (!speakerName) continue;

      // 前のマッチの残り文字列や「一般質問」を除去してトピックをクリーニング
      // 「】」以降のテキストのみを取得（直前の質問と混入しないように）
      const lastBracketEnd = topicRaw.lastIndexOf("】");
      const topicCleaned =
        lastBracketEnd >= 0
          ? topicRaw.slice(lastBracketEnd + 1).trim()
          : topicRaw.replace(/^.*?一般質問\s*/s, "").trim();

      const topic = topicCleaned || "一般質問";

      results.push({ speakerName, topic });
    }
  }

  return results;
}

/**
 * PDF テキストから ParsedStatement 配列を生成する。
 *
 * 積丹町の PDF は逐語録ではなく会議の結果概要のため、
 * 一般質問の質問者を question として扱う。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const questions = parseQuestions(text);

  for (const q of questions) {
    const content = q.topic
      ? `${q.topic}`
      : "一般質問";

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: "question",
      speakerName: q.speakerName,
      speakerRole: "議員",
      content,
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
      `[014052-shakotan] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 * PDF をダウンロード・テキスト抽出し、一般質問者情報を抽出する。
 */
export async function buildMeetingData(
  params: ShakotanDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出
  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `shakotan_${heldOn}_${params.title}`,
    statements,
  };
}
