/**
 * 大蔵村議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、役職名で発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（○ マーカー付き）:
 *   ○議長（鈴木太郎） ただいまの出席議員数は…
 *   ○村長（山田次郎） お答えします。
 *   ○1番（田中三郎） 質問します。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OkuraMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 直接一致する役職名（完全一致で判定）
const DIRECT_ROLES = [
  "議長",
  "副議長",
  "村長",
  "副村長",
  "教育長",
  "議会事務局長",
];

// 役職サフィックス（部分一致で判定、長い方を先に）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
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
  "補佐",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
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
  "補佐",
  "議会事務局長",
]);

/**
 * 発言者の役職テキストから正規化された speakerRole を返す。
 *
 * e.g., "健康福祉課長" → "課長"
 *       "議長" → "議長"
 *       "１番" → "議員"
 */
export function normalizeRole(roleText: string): string {
  // 番号議員: １番, 10番 etc.
  if (/^[０-９\d]+番$/.test(roleText)) return "議員";

  // 直接一致
  if (DIRECT_ROLES.includes(roleText)) return roleText;

  // サフィックス一致
  for (const suffix of ROLE_SUFFIXES) {
    if (roleText.endsWith(suffix)) return suffix;
  }

  return roleText;
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
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
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * ○マーカー付き発言者パターンの正規表現。
 *
 * 大蔵村の PDF テキストでは、発言者は ○ マーカーで始まる:
 *   "○議長（鈴木太郎）"
 *   "○村長（山田次郎）"
 *   "○1番（田中三郎）"
 *   "○総務課長（佐藤四郎）"
 *
 * ○の後に役職名、括弧内に個人名が来るパターン。
 * 個人名なしのケース（"○議長 "）にも対応。
 */
const SPEAKER_PATTERN = /○([^（\s]+?)(?:（([^）]+)）)?[\s　]/g;

/**
 * PDF テキストから発言開始位置を検出する。
 * 「開会」「開議」「再開」の直前が議事開始点。
 */
export function findProceedingsStart(text: string): number {
  const match = text.match(/(?:午前|午後)[０-９\d]+時[０-９\d]*分?\s*(?:開会|開議|再開)/);
  if (match) return match.index!;
  return 0;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * ○マーカーで発言者を検出し、発言内容を切り出す。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const startPos = findProceedingsStart(text);
  const bodyText = startPos > 0 ? text.substring(startPos) : text;

  SPEAKER_PATTERN.lastIndex = 0;
  const statements: ParsedStatement[] = [];

  // 発言者の切り替わり位置を収集
  const splits: {
    pos: number;
    role: string;
    speakerName: string | null;
    matchLen: number;
  }[] = [];

  for (const m of bodyText.matchAll(SPEAKER_PATTERN)) {
    splits.push({
      pos: m.index!,
      role: m[1]!.trim(),
      speakerName: m[2] ? m[2].trim() : null,
      matchLen: m[0].length,
    });
  }

  if (splits.length === 0) return [];

  let offset = 0;

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i]!;
    const roleText = split.role;
    const speakerRole = normalizeRole(roleText);

    // 発言内容: マーカーの後から次の発言者の前まで
    const contentStart = split.pos + split.matchLen;
    const contentEnd =
      i + 1 < splits.length ? splits[i + 1]!.pos : bodyText.length;

    let content = bodyText.substring(contentStart, contentEnd).trim();

    // 末尾のページ番号パターンを除去
    content = content.replace(/\s*-\s*\d+\s*-\s*$/, "").trim();

    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName: split.speakerName,
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
      `[063657-okura] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OkuraMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // ファイル名からexternalIdを生成
  const filenameMatch = meeting.pdfUrl.match(/\/([^/]+)\.pdf$/i);
  const externalId = filenameMatch
    ? `okura_${filenameMatch[1]!.toLowerCase()}`
    : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
