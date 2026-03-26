/**
 * 北島町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言ブロックを分割して
 * ParsedStatement 配列を生成する。
 *
 * 北島町の PDF は各文字の間にスペースが入るフォーマットで抽出される。
 * 発言フォーマット:
 *   名前議員（質問N）質問テキスト
 *   （答弁）名前役職名答弁テキスト
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface KitajimaDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
  pdfPath: string;
}

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
  "所長",
  "館長",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "所長",
  "館長",
]);

/**
 * PDF テキスト（各文字間にスペースあり）を正規化する。
 * 日本語文字間のスペースを除去する。
 */
export function normalizePdfText(text: string): string {
  let s = text;
  // 日本語文字（非ASCII）間のスペースを繰り返し除去（複数回で確実に除去）
  for (let i = 0; i < 10; i++) {
    s = s.replace(/([^\x00-\x7F\n]) ([^\x00-\x7F\n])/g, "$1$2");
  }
  return s.trim();
}

/**
 * 答弁コンテンツ先頭の話者テキスト（「名前役職名」）の長さを推定する。
 *
 * 役職サフィックスで出現位置を全て走査し、最も後方の位置を返す。
 * 「兼」で繋がる複合役職（例: 「総務課長兼行財政改革推進室長」）にも対応。
 */
function extractSpeakerTextLength(content: string): number {
  let maxEnd = 0;
  for (const suffix of ROLE_SUFFIXES) {
    let searchFrom = 0;
    while (true) {
      const idx = content.indexOf(suffix, searchFrom);
      // 40文字以内に役職が現れる場合のみ話者部分とみなす
      if (idx < 0 || idx >= 40) break;
      const end = idx + suffix.length;
      if (end > maxEnd) maxEnd = end;
      searchFrom = end;
    }
  }
  return maxEnd;
}

/**
 * （答弁）ラベルの後の「名前役職名」から発言者情報を抽出する。
 *
 * 例: "藤髙総務課長兼行財政改革推進室長" → name=藤髙総務, role=課長
 * 例: "粟田教育委員会事務局長" → name=粟田教育委員会, role=事務局長
 * 例: "亀井図書館・創世ホール館長" → name=亀井図書館・創世ホール, role=館長
 */
export function parseAnswerSpeaker(speakerText: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 役職サフィックスで最初にマッチするものを使用
  for (const suffix of ROLE_SUFFIXES) {
    const idx = speakerText.indexOf(suffix);
    if (idx > 0) {
      const before = speakerText.slice(0, idx);
      const nameMatch = before.match(/^(\S+)/);
      const speakerName = nameMatch?.[1] ?? null;
      return { speakerName, speakerRole: suffix };
    }
  }

  return { speakerName: speakerText || null, speakerRole: null };
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
 * 正規化済みテキストを ParsedStatement 配列に変換する。
 *
 * パターン:
 *   名前議員（質問N）本文 → 質問発言（speakerRole=議員）
 *   （答弁）名前役職名本文 → 答弁発言
 */
export function parseStatements(text: string): ParsedStatement[] {
  const normalized = normalizePdfText(text);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 発言区切りパターン:
  //   質問: 「名前議員（質問N）」 （議員名は漢字ひらがなカタカナ 1〜8文字）
  //   答弁: 「（答弁）」
  const delimiter =
    /([\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{1,8}議員（質問[０-９\d]*）|（答弁）)/g;

  const parts = normalized.split(delimiter);

  // parts は [前テキスト, 区切り1, テキスト1, 区切り2, テキスト2, ...] の形式
  for (let i = 1; i < parts.length; i += 2) {
    const delim = parts[i]!;
    const rawContent = parts[i + 1]?.trim() ?? "";

    if (!rawContent) continue;

    if (delim === "（答弁）") {
      // 答弁パターン: コンテンツの先頭が「名前役職名本文」
      const speakerLen = extractSpeakerTextLength(rawContent);
      const speakerText = rawContent.slice(0, speakerLen);
      const body = rawContent.slice(speakerLen).trim();

      if (!body) continue;

      const { speakerName, speakerRole } = parseAnswerSpeaker(speakerText);
      const kind = classifyKind(speakerRole);

      const contentHash = createHash("sha256").update(body).digest("hex");
      const startOffset = offset;
      const endOffset = offset + body.length;
      statements.push({
        kind,
        speakerName,
        speakerRole,
        content: body,
        contentHash,
        startOffset,
        endOffset,
      });
      offset = endOffset + 1;
    } else {
      // 質問パターン: 「名前議員（質問N）」区切り
      const nameMatch = delim.match(/^(.+?)議員（質問[０-９\d]*）/);
      const speakerName = nameMatch?.[1] ?? null;

      const contentHash = createHash("sha256").update(rawContent).digest("hex");
      const startOffset = offset;
      const endOffset = offset + rawContent.length;
      statements.push({
        kind: "question",
        speakerName,
        speakerRole: "議員",
        content: rawContent,
        contentHash,
        startOffset,
        endOffset,
      });
      offset = endOffset + 1;
    }
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
      `[364029-kitajima] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 * PDF をダウンロード・テキスト抽出し、発言を解析する。
 */
export async function buildMeetingData(
  params: KitajimaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  const statements = text ? parseStatements(text) : [];

  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `kitajima_${params.pdfPath}`,
    statements,
  };
}
