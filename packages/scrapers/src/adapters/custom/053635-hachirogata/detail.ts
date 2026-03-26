/**
 * 八郎潟町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 八郎潟町の PDF は ○ マーカーを使わず、発言者が以下の形式でインラインに記載される:
 *   議長 伊藤秋雄 おはようございます。...
 *   町長 畠山菊夫 お答えします。...
 *   ２番 小柳 聡 質問します。...
 *   産業課長 相澤重則 ご説明します。...
 *   議会運営委員長 畠山一充 ご報告します。...
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HachirogataMeeting } from "./list";
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
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
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
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 役職文字列から正規化された役職サフィックスを返す。
 * 例: "産業課長" -> "課長", "議長" -> "議長", "３番" -> "議員"
 */
export function normalizeRole(role: string): string {
  if (/^[０-９\d]+番$/.test(role)) return "議員";
  for (const suffix of ROLE_SUFFIXES) {
    if (role === suffix || role.endsWith(suffix)) return suffix;
  }
  return role;
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
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * テキストから発言者の位置を検出する。
 *
 * 八郎潟町の PDF テキストには改行がなく、発言者が
 * "議長 伊藤秋雄 " のようにインラインで記載される。
 */
export function findSpeakerPositions(
  text: string,
): { index: number; role: string; name: string; contentStart: number }[] {
  const positions: {
    index: number;
    role: string;
    name: string;
    contentStart: number;
  }[] = [];

  // 役職パターン（長い方を先に配置）
  const rolePatterns = [
    "議会運営委員会?委員長",
    "[^\\s]{1,8}副委員長",
    "副委員長",
    "[^\\s]{1,8}委員長",
    "委員長",
    "副議長",
    "議長",
    "副町長",
    "町長",
    "副教育長",
    "教育長",
    "[^\\s]{1,8}事務局長",
    "事務局長",
    "[^\\s]{1,8}局長",
    "局長",
    "[^\\s]{1,8}副部長",
    "副部長",
    "[^\\s]{1,8}部長",
    "部長",
    "[^\\s]{1,8}副課長",
    "副課長",
    "[^\\s]{1,8}課長",
    "課長",
    "[^\\s]{1,8}室長",
    "室長",
    "[^\\s]{1,8}係長",
    "係長",
    "[^\\s]{1,8}参事",
    "参事",
    "[^\\s]{1,8}主幹",
    "主幹",
    "[^\\s]{1,8}補佐",
    "補佐",
    "[０-９\\d]+番",
  ];

  const roleGroup = rolePatterns.join("|");
  // Match: (role) (space) (name: 漢字2-6文字, potentially with space in between) (space)
  const re = new RegExp(
    `(?:^|(?<= ))(${roleGroup})\\s+([\\p{Script=Han}]{1,4}[\\s　]?[\\p{Script=Han}]{1,4})\\s`,
    "gu",
  );

  for (const m of text.matchAll(re)) {
    const fullMatch = m[0]!;
    const role = m[1]!;
    const name = m[2]!.replace(/[\s　]+/g, "");
    const index = m.index!;
    const contentStart = index + fullMatch.length;

    // Skip if the role is part of a longer word (e.g., "議長 より指名" is not a speaker)
    // Check if next char after name+space looks like content start
    positions.push({ index, role, name, contentStart });
  }

  return positions;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * ○ マーカーではなく、インラインの「役職 氏名 発言内容」パターンで分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const positions = findSpeakerPositions(text);
  if (positions.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]!;
    const nextPos = positions[i + 1];
    const contentEnd = nextPos ? nextPos.index : text.length;
    const content = text.slice(pos.contentStart, contentEnd).trim();

    if (!content) continue;

    // Skip stage directions (ト書き)
    if (/^[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(content)) continue;

    const normalizedRole = normalizeRole(pos.role);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(normalizedRole),
      speakerName: pos.name,
      speakerRole: normalizedRole,
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
      `[053635-hachirogata] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HachirogataMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOn(text, meeting.title);
  if (!heldOn) return null;

  const externalId = `hachirogata_${meeting.meetingId}`;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}

/**
 * PDF テキストまたはタイトルから開催日を抽出する。
 * PDF 冒頭に「令和○年○月○日」形式の日付が含まれることを期待する。
 * 全角数字にも対応する。
 */
export function extractHeldOn(text: string, title: string): string | null {
  // PDF テキストから日付を探す（全角数字にも対応）
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const dateMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (dateMatch) {
    const era = dateMatch[1]!;
    const eraYear = dateMatch[2] === "元" ? 1 : Number(dateMatch[2]);
    const month = Number(dateMatch[3]);
    const day = Number(dateMatch[4]);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else return extractHeldOnFromTitle(title);

    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return extractHeldOnFromTitle(title);
}

/**
 * タイトルから年月を推定して開催日を返す。
 * 例: "令和6年八郎潟町議会12月定例会議事録" -> "2024-12-01"
 */
function extractHeldOnFromTitle(title: string): string | null {
  const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
  const monthMatch = title.match(/(\d+)月(?:定例会|臨時会)/);

  if (eraMatch && monthMatch) {
    const era = eraMatch[1]!;
    const eraYear = eraMatch[2] === "元" ? 1 : Number(eraMatch[2]);
    const month = Number(monthMatch[1]);

    let westernYear: number;
    if (era === "令和") westernYear = eraYear + 2018;
    else if (era === "平成") westernYear = eraYear + 1988;
    else return null;

    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}
