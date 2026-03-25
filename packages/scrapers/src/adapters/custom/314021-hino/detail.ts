/**
 * 日野町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（中原 信男君）　それでは、ただいまから会議を開きます。
 *   ○町長（﨏田 淳一君）　お答えいたします。
 *   ○議員（８番 安達 幸博君）　質問いたします。
 *   ○総務課長（景山 政之君）　ご説明いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HinoMeeting } from "./list";
import { parseDateFromPdfText } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

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
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "参事",
  "主幹",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "参事",
  "主幹",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（中原 信男君）　→ role=議長, name=中原信男
 *   ○町長（﨏田 淳一君）　→ role=町長, name=﨏田淳一
 *   ○議員（８番 安達 幸博君）→ role=議員, name=安達幸博
 *   ○総務課長（景山 政之君）→ role=課長, name=景山政之
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const nameRaw = match[2]!.trim();
    const content = match[3]!.trim();

    // 議員パターン: ○議員（８番 安達 幸博君） → 番号を除去、名前のスペースを除去
    if (rolePart === "議員") {
      const memberMatch = nameRaw.match(/^[\d０-９]+番[\s　]+(.+)/);
      const name = memberMatch
        ? memberMatch[1]!.replace(/[\s　]+/g, "")
        : nameRaw.replace(/[\s　]+/g, "");
      return { speakerName: name, speakerRole: "議員", content };
    }

    // 番号付き議員: ○８番（安達 幸博君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      const name = nameRaw.replace(/[\s　]+/g, "");
      return { speakerName: name, speakerRole: "議員", content };
    }

    // 役職マッチ
    const name = nameRaw.replace(/[\s　]+/g, "");
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: name, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  // endsWith で複合役職名もチェック
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストを前処理する。
 * - ページ番号（－1－ 等）を除去
 * - 罫線（───）を除去
 */
function preprocessText(text: string): string {
  return text
    .replace(/－\d+－/g, "")
    .replace(/─+/g, "")
    .replace(/\r\n/g, "\n");
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const cleaned = preprocessText(text);
  const blocks = cleaned.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    // 改行をスペースに正規化（PDF の改行位置が不規則なため）
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
      `[314021-hino] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HinoMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから開催日を抽出
  const heldOn = meeting.heldOn || parseDateFromPdfText(text);
  if (!heldOn) return null;

  // externalId: PDF パスから一意キーを生成
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const pathMatch = urlPath.match(/\/secure\/(\d+)\/([^/]+)\.pdf$/i);
  const externalId = pathMatch
    ? `hino_${pathMatch[1]}_${pathMatch[2]}`
    : `hino_${createHash("md5").update(meeting.pdfUrl).digest("hex").slice(0, 12)}`;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.sessionTitle),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
