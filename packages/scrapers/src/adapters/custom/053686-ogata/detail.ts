/**
 * 大潟村議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 大潟村の PDF は【役職：名前】パターンを使った発言者表記:
 *   【議長：丹野敏彦】 おはようございます。
 *   【村長：髙橋浩人】 お答えします。
 *   【議会運営委員長：黒瀬友基】 ご報告します。
 *   【総務企画課長：石川歳男】 ご説明します。
 *
 * PDF テキストは改行なしで1行に連結されているため、
 *【...】マーカーをセパレーターとして使って分割する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OgataMeeting } from "./list";
import { convertJapaneseEra, detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
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
  "村長",
  "副村長",
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
 * 役職文字列から正規化された役職サフィックスを返す。
 * 例: "総務企画課長" -> "課長", "議長" -> "議長", "農業委員会事務局長" -> "事務局長"
 */
export function normalizeRole(role: string): string {
  for (const suffix of ROLE_SUFFIXES) {
    if (role === suffix || role.endsWith(suffix)) return suffix;
  }
  return role;
}

/**
 *【役職：名前】形式のマーカーを解析する。
 *
 * パターン:
 *   【議長：丹野敏彦】
 *   【村長：髙橋浩人】
 *   【総務企画課長：石川歳男】
 *   【議会運営委員長：黒瀬友基】
 *
 * @returns { speakerRole, speakerName } または null（マーカー形式でない場合）
 */
export function parseMarker(marker: string): {
  speakerRole: string;
  speakerName: string;
} | null {
  // 【役職：名前】 形式
  const m = marker.match(/^【(.+?)：(.+?)】$/);
  if (!m) return null;

  const rawRole = m[1]!.trim();
  const rawName = m[2]!.trim();

  return {
    speakerRole: normalizeRole(rawRole),
    speakerName: rawName,
  };
}

/**
 * PDF テキストを ParsedStatement 配列に変換する。
 *
 * 【役職：名前】マーカーで発言を分割する。
 * テキストは1行に連結されているため、マーカーをセパレーターとして使う。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 【...】マーカーで分割
  // 例: "...前テキスト【議長：丹野敏彦】 発言内容 【村長：髙橋浩人】 答弁内容..."
  const markerRegex = /【[^】]*】/g;
  const markerMatches = [...text.matchAll(markerRegex)];

  if (markerMatches.length === 0) return [];

  for (let i = 0; i < markerMatches.length; i++) {
    const markerMatch = markerMatches[i]!;
    const marker = markerMatch[0]!;
    const markerEnd = markerMatch.index! + marker.length;

    // マーカーを解析
    const parsed = parseMarker(marker);
    if (!parsed) continue;

    // このマーカー以降、次のマーカーまでの内容を取得
    const nextMarkerIndex =
      i + 1 < markerMatches.length ? markerMatches[i + 1]!.index! : text.length;
    const rawContent = text.slice(markerEnd, nextMarkerIndex);
    const content = rawContent.replace(/\s+/g, " ").trim();

    if (!content) continue;

    // ステージ指示（ト書き）のみの発言はスキップ
    if (/^[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(content)) continue;

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
 * PDF テキストから開催日を抽出する。
 * 「令和X年X月X日」形式の日付を探す（全角数字にも対応）。
 * 見つからない場合はタイトルから月情報を抽出して月初日を返す。
 */
export function extractHeldOn(text: string, title: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // PDF テキストから日付を探す（「開議日時」付近）
  const dateMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (dateMatch) {
    const year = convertJapaneseEra(dateMatch[1]!, dateMatch[2]!);
    if (year !== null) {
      const month = Number(dateMatch[3]);
      const day = Number(dateMatch[4]);
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // タイトルから月情報を推定して月初日を返す
  return extractHeldOnFromTitle(title);
}

/**
 * タイトルから年月を推定して開催日を返す。
 * 例: "令和6年第8回（12月）定例会 会議録" -> "2024-12-01"
 */
function extractHeldOnFromTitle(title: string): string | null {
  // 「（X月）」パターンで月を取得
  const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
  const monthMatch = title.match(/[（(](\d+)月[）)]/);

  if (eraMatch && monthMatch) {
    const year = convertJapaneseEra(eraMatch[1]!, eraMatch[2]!);
    if (year !== null) {
      const month = Number(monthMatch[1]);
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  return null;
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
      `[053686-ogata] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OgataMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOn(text, meeting.title);
  if (!heldOn) return null;

  const externalId = `ogata_${meeting.meetingId}`;

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
