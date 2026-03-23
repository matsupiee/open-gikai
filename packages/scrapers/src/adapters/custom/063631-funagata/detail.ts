/**
 * 舟形町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、役職名で発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 舟形町の PDF は ○ マーカーを使わず、役職名が直接発言の冒頭に現れる。
 * テキストは改行なしの連続テキストとして抽出される。
 *
 * 発言フォーマット:
 *   議長 ただいまの出席議員数９名です。
 *   ３番 おはようございます。
 *   町長 それでは、お答えいたします。
 *   健康福祉課長 ご説明いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FunagataMeeting } from "./list";
import { detectMeetingType, extractExternalIdKey, fetchBinary } from "./shared";

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
  "委員長",
  "副委員長",
  "副部長",
  "副課長",
  "部長",
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
 * e.g., "健康福祉課長" → "課長"
 *       "議長" → "議長"
 *       "３番" → "議員"
 */
export function normalizeRole(roleText: string): string {
  // 番号議員: ３番, 10番 etc.
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
export function classifyKind(speakerRole: string | null): string {
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
 * 発言者パターンの正規表現。
 *
 * 舟形町の PDF テキストでは、発言者の切り替わりは以下のパターンで現れる:
 *   "。 議長 " / "） 町長 " / "。 ３番 " / "。 健康福祉課長 "
 *
 * 直前の文末（。）の後にスペースがあり、役職名、またスペースが続く。
 */
const SPEAKER_PATTERN = (() => {
  const directRoles = DIRECT_ROLES.join("|");
  const suffixRoles = ROLE_SUFFIXES.map((s) => `[^\\s。、]{1,10}${s}`).join("|");
  const numberRole = "[０-９\\d]+番";

  return new RegExp(
    `(?<=[。）)] )((?:${directRoles}|${numberRole}|${suffixRoles}) )`,
    "g"
  );
})();

/**
 * PDF テキストからヘッダー部分（名簿等）をスキップし、
 * 実際の議事が始まる位置を返す。
 *
 * 「開会」「開議」「再開」の直前が議事開始点。
 * 見つからない場合は 0 を返す。
 */
export function findProceedingsStart(text: string): number {
  // "午前/午後 + 時分 + 開会/開議/再開" パターンを探す
  const match = text.match(/(?:午前|午後)[０-９\d]+時[０-９\d]*分?\s*(開会|開議|再開)/);
  if (match) return match.index!;
  return 0;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * テキストは改行なしの連続テキスト。発言者の切り替わりは
 * 「文末(。/）) + スペース + 役職名 + スペース」で検出する。
 *
 * ヘッダー部分（出席議員名簿等）は自動的にスキップする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ヘッダー部分をスキップして議事本体から開始
  const startPos = findProceedingsStart(text);
  const bodyText = startPos > 0 ? text.substring(startPos) : text;

  // lastIndex をリセットして再利用可能にする
  SPEAKER_PATTERN.lastIndex = 0;
  const statements: ParsedStatement[] = [];

  // 発言者の切り替わり位置を収集
  const splits: { pos: number; role: string; matchLen: number }[] = [];
  for (const m of bodyText.matchAll(SPEAKER_PATTERN)) {
    splits.push({
      pos: m.index!,
      role: m[1]!.trim(),
      matchLen: m[0].length,
    });
  }

  if (splits.length === 0) return [];

  let offset = 0;

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i]!;
    const roleText = split.role;
    const speakerRole = normalizeRole(roleText);

    // 発言内容: 役職名の後から次の発言者の前まで
    const contentStart = split.pos + split.matchLen;
    const contentEnd =
      i + 1 < splits.length ? splits[i + 1]!.pos : bodyText.length;

    // 内容から末尾の不要な空白を除去し、次の発言者の前の句点までを取得
    let content = bodyText.substring(contentStart, contentEnd).trim();

    // 末尾がページ番号パターン（例: "- 15 -"）で終わる場合は除去
    content = content.replace(/\s*-\s*\d+\s*-\s*$/, "").trim();

    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName: null, // 舟形町の PDF では発言者名は役職のみで個人名なし
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
      `[063631-funagata] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: FunagataMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `funagata_${idKey}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
