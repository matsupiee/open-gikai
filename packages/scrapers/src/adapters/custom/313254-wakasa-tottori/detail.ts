/**
 * 若桜町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言ブロックに分割する。
 *
 * 発言フォーマット:
 *   議長（川上守）
 *   町長（上川元張）
 *   副町長（氏名）
 *   教育長（氏名）
 *   ○○課長（氏名）
 *
 * - `○` 記号は使用されない
 * - 発言者行の形式: `{役職}（{氏名}）`
 * - 発言者行の後に発言内容が続く
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { WakasaMeeting } from "./list";
import { fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局次長",
  "事務局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "副教育長",
  "教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "管理者",
  "事務局長",
  "事務局次長",
]);

/**
 * 発言者行「役職（氏名）」を解析して発言者情報を返す。
 *
 * パターン:
 *   "議長（川上守）" → role="議長", name="川上守"
 *   "町長（上川元張）" → role="町長", name="上川元張"
 *   "総務課長（田中一郎）" → role="課長", name="田中一郎"
 */
export function parseSpeakerLine(line: string): {
  speakerName: string;
  speakerRole: string;
} | null {
  const match = line.match(/^(.+?)（(.+?)）\s*$/);
  if (!match) return null;

  const rolePart = match[1]!.trim();
  const name = match[2]!.trim().replace(/[\s　]+/g, "");

  if (!rolePart || !name) return null;

  // ROLE_SUFFIXES で役職を特定
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return { speakerName: name, speakerRole: suffix };
    }
  }

  // 既知の役職に合致しない場合でも、括弧パターンならそのまま使用
  return { speakerName: name, speakerRole: rolePart };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string,
): "remark" | "question" | "answer" {
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストを発言単位に分割する。
 *
 * 若桜町の PDF には ○ マーカーがなく、
 * PDF 抽出後のテキストが1行のスペース区切りになる場合がある（mergePages 時）。
 * また、行単位で抽出される場合もある。
 * そのため、発言者パターン（役職（氏名））の出現位置を検出して分割する。
 *
 * 対応パターン（スペース区切りの1行テキスト）:
 *   "... 議長（川上守） 皆さん。 ... 町長（上川元張） お答えします。 ..."
 *
 * 対応パターン（改行区切りのテキスト）:
 *   "議長（川上守）\n皆さん。\n町長（上川元張）\nお答えします。"
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 発言者パターンの全出現位置を検出する正規表現
  // e.g. "議長（川上守）" や "総務課長（鈴木太郎）" にマッチ
  const speakerRe = new RegExp(
    `((?:[^（\\s、。　]{1,15})?(?:副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|事務局次長|事務局長|副部長|部長|副課長|課長|室長|局長|係長|参事|主幹|主査|管理者|議員|委員))（([^）]{1,20})）`,
    "g",
  );

  const matches = [...text.matchAll(speakerRe)];
  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const nextMatch = matches[i + 1];

    const rolePart = match[1]!.trim();
    const name = match[2]!.trim().replace(/[\s　]+/g, "");

    // 発言内容: 現在の発言者パターン終端から次の発言者パターン開始まで
    const contentStart = match.index! + match[0].length;
    const contentEnd = nextMatch ? nextMatch.index! : text.length;
    const content = text.slice(contentStart, contentEnd).trim();

    if (!name || !content) continue;

    // 役職を特定（長いものを優先）
    let speakerRole = rolePart;
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        speakerRole = suffix;
        break;
      }
    }

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName: name,
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

/**
 * PDF から抽出したテキストを返す。
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
      `[313254-wakasa-tottori] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: WakasaMeeting,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // ファイル名から externalId を生成
  const filename =
    meeting.pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `wakasa_${filename}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
