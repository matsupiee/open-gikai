/**
 * 下仁田町議会（群馬県） — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から PDF をダウンロードし、
 * テキスト抽出・発言パースを行って MeetingData を返す。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface ShimonitaDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  meetingHeading: string;
}

/**
 * 役職サフィックスリスト（長い方を先に配置）
 */
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
  "議長",
  "町長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
]);

/** 全角数字を半角に変換 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 下仁田町のフォーマット:
 *   "○議長 佐藤博 ..." （役職 + スペース + 氏名 + スペース + 発言内容）
 *   "○１番 堀越健介 ..." （番号 + スペース + 氏名 + スペース + 発言内容）
 *   "○議会事務局長 佐藤正明 ..." （役職 + スペース + 氏名 + スペース + 発言内容）
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: {役職またはN番} {氏名} {本文}
  // 最初のトークンが役職/番号、2番目が氏名、残りが本文
  const tokens = stripped.match(/^(\S+)\s+(\S+)\s*([\s\S]*)$/);
  if (tokens) {
    const firstToken = tokens[1]!.trim();
    const secondToken = tokens[2]!.trim();
    const remaining = tokens[3]!.trim();

    // 2番目のトークンが氏名らしいか（記号を含まない）を確認
    const looksLikeName = /^[\p{L}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\s]+$/u.test(secondToken);

    if (looksLikeName) {
      // 役職サフィックスにマッチするか確認
      for (const suffix of ROLE_SUFFIXES) {
        if (firstToken.endsWith(suffix)) {
          return {
            speakerName: secondToken,
            speakerRole: suffix,
            content: remaining,
          };
        }
      }

      // 議員番号パターン（例: "７番", "１０番", "1番"）
      if (/^\d+番$/.test(toHalfWidth(firstToken))) {
        return {
          speakerName: secondToken,
          speakerRole: "議員",
          content: remaining,
        };
      }

      // その他（役職名そのまま）
      return {
        speakerName: secondToken,
        speakerRole: firstToken,
        content: remaining,
      };
    }
  }

  // フォールバック: 括弧付きパターン ○{役職}（{氏名}[君]）
  const bracketPattern = /^(\S+?)（(.+?)(?:君)?）[\s　]*([\s\S]*)$/;
  const bracketMatch = stripped.match(bracketPattern);
  if (bracketMatch) {
    const roleOrNumber = bracketMatch[1]!.trim();
    const name = bracketMatch[2]!.trim();
    const content = bracketMatch[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrNumber.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
    if (/^\d+番$/.test(toHalfWidth(roleOrNumber))) {
      return { speakerName: name, speakerRole: "議員", content };
    }
    return { speakerName: name, speakerRole: roleOrNumber, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
): "question" | "answer" | "remark" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  return "question";
}

/**
 * PDF から抽出されたテキストを発言単位に分割する。
 *
 * 下仁田町のPDFは mergePages: true で抽出した場合、改行がなく1行テキストになる。
 * そのため ○ 記号を区切りとして発言ブロックに分割する。
 *
 * 発言パターン: "○議長 佐藤博 ..." / "○１番 堀越健介 ..."
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // ○ で始まる発言ブロックに分割
  // "──..." のような区切り線を除去してから分割する
  const cleaned = text
    .replace(/─+/g, " ")
    .replace(/－\s*\d+\s*－/g, " ")
    .replace(/- \d+ -/g, " ");

  // ○ で分割（最初のトークンは ○ より前のヘッダー部分なのでスキップ）
  const blocks = cleaned.split("○").slice(1);

  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const fullText = "○" + trimmed;

    // 発言者パターン確認: "○{役職/番号} {氏名} ..." の形
    const isSpeakerBlock =
      /^[○◯●]\s*\S+[\s　]+[\p{L}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/u.test(fullText);

    if (!isSpeakerBlock) continue;

    const parsed = parseSpeaker(fullText);

    // 有効な役職名または議員番号のみを対象とする
    // 出席表の ○マーク（「応招・出席を 示す」等）を除外する
    if (!parsed.speakerRole) continue;
    const isValidRole =
      ROLE_SUFFIXES.some((s) => parsed.speakerRole === s || parsed.speakerRole?.endsWith(s)) ||
      parsed.speakerRole === "議員";
    if (!isValidRole) continue;

    if (!parsed.content) continue;

    const content = parsed.content.trim();
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(parsed.speakerRole),
      speakerName: parsed.speakerName,
      speakerRole: parsed.speakerRole,
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
 * PDF をダウンロードしてテキスト抽出し、MeetingData を返す。
 * statements が空なら null を返す。
 * heldOn が解析できない場合は null を返す。
 */
export async function fetchMeetingData(
  params: ShimonitaDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const buffer = await fetchBinary(params.pdfUrl);
  if (!buffer) return null;

  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    text = extracted.text;
  } catch (e) {
    console.warn(
      `[103829-shimonita] PDF テキスト抽出失敗: ${params.pdfUrl}`,
      e
    );
    return null;
  }

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `shimonita_${encodeURIComponent(params.pdfUrl)}`,
    statements,
  };
}
