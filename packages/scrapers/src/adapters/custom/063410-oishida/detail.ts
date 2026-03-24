/**
 * 大石田町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 大石田町の PDF では発言者は以下の形式で現れる:
 *   １．議長（大山二郎君）
 *   １．８番（小玉勇君）
 *   １．町長（庄司中君）
 *   １．総務課長（土屋弘行君）
 *   １．議会運営委員会委員長（今野雅信君）
 *
 * フォーマット: 数字．役職（名前君）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OishidaMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 直接一致する役職名（完全一致で判定）
const DIRECT_ROLES = [
  "議長",
  "副議長",
  "町長",
  "副町長",
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
  "町長",
  "副町長",
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
 * e.g., "総務課長" → "課長"
 *       "議長" → "議長"
 *       "８番" / "10番" → "議員"
 *       "議会運営委員会委員長" → "委員長"
 */
export function normalizeRole(roleText: string): string {
  // 番号議員: ８番, 10番 etc.（全角・半角両対応）
  if (/^[０-９\d]+番$/.test(roleText)) return "議員";

  // 直接一致
  if (DIRECT_ROLES.includes(roleText)) return roleText;

  // サフィックス一致（長い方が先）
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
 * PDF テキストからヘッダー部分（名簿等）をスキップし、
 * 議事本体が始まる位置を返す。
 *
 * 「議 事 の 経 過」の直後が議事開始点。
 * 見つからない場合は 0 を返す。
 */
export function findProceedingsStart(text: string): number {
  const match = text.match(/議\s*事\s*の\s*経\s*過/);
  if (match) return match.index!;
  return 0;
}

/**
 * 発言者パターン: 数字．役職（名前君）
 *
 * 大石田町の PDF では発言者の切り替わりは以下の形式で現れる:
 *   "１．議長（大山二郎君）"
 *   "１．８番（小玉勇君）"
 *   "１．総務課長（土屋弘行君）"
 */
const SPEAKER_PATTERN = (() => {
  const directRoles = DIRECT_ROLES.join("|");
  const suffixRoles = ROLE_SUFFIXES.map((s) => `[^（\\s。、]{1,15}${s}`).join("|");
  const numberRole = "[０-９\\d]+番";

  return new RegExp(
    `[１-９１０\\d]+．((?:${directRoles}|${numberRole}|${suffixRoles}))（([^）]{1,20})君）`,
    "g"
  );
})();

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 発言者の切り替わりは「数字．役職（名前君）」で検出する。
 * ヘッダー部分（提出議案目録等）は「議 事 の 経 過」以降を使用。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ヘッダー部分をスキップして議事本体から開始
  const startPos = findProceedingsStart(text);
  const bodyText = startPos > 0 ? text.substring(startPos) : text;

  // lastIndex をリセットして再利用可能にする
  SPEAKER_PATTERN.lastIndex = 0;
  const statements: ParsedStatement[] = [];

  // 発言者の切り替わり位置を収集
  const splits: { pos: number; role: string; name: string; matchLen: number }[] = [];
  for (const m of bodyText.matchAll(SPEAKER_PATTERN)) {
    splits.push({
      pos: m.index!,
      role: m[1]!.trim(),
      name: m[2]!.trim(),
      matchLen: m[0].length,
    });
  }

  if (splits.length === 0) return [];

  let offset = 0;

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i]!;
    const roleText = split.role;
    const speakerRole = normalizeRole(roleText);
    const speakerName = split.name || null;

    // 発言内容: 役職名の後から次の発言者の前まで
    const contentStart = split.pos + split.matchLen;
    const contentEnd =
      i + 1 < splits.length ? splits[i + 1]!.pos : bodyText.length;

    let content = bodyText.substring(contentStart, contentEnd).trim();

    // ページ番号パターン（例: "令和 6 年第１回定例会（3 月）本会議 5"）を除去
    content = content
      .replace(/令和\s*\d+\s*年[^\n]*本会議\s*\d+/g, "")
      .trim();

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
      `[063410-oishida] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OishidaMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF ファイル名から externalId を生成
  const pdfFileName = new URL(meeting.pdfUrl).pathname
    .replace(/^.*\//, "")
    .replace(/\.pdf$/i, "");
  const externalId = pdfFileName ? `oishida_${pdfFileName}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn as string,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
