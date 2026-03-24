/**
 * 御船町議会（熊本県） — detail フェーズ
 *
 * detailParams に含まれる PDF URL からテキストを抽出し、
 * 発言（ParsedStatement）に変換して MeetingData を組み立てる。
 *
 * 御船町の会議録 PDF は「◯役職　発言内容」形式で記録される。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
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
] as const;

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

export interface MifuneDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: string;
}

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 対応パターン:
 *   ◯田中議長　ただいまから開会します。
 *   ◯山田町長　お答えいたします。
 *   ◯佐藤議員　質問いたします。
 *   ◯鈴木総務課長　ご説明いたします。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 先頭の名前+役職部分を取得（スペースまで）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = headerMatch[2]!.trim();

  // 役職サフィックスにマッチする場合
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  // ◯マーカーがある場合、役職が不明でも先頭を名前として扱う
  if (/^[○◯◎●]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
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
 * PDF テキストを ParsedStatement 配列に変換する。
 *
 * ◯マーカーで発言ブロックを区切る。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].*?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

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

/** PDF URL からテキストを抽出する */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[434418-mifune] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 *
 * PDF をダウンロードしてテキスト抽出し、発言を解析する。
 * statements が空の場合は null を返す。
 */
export async function fetchMeetingData(
  params: MifuneDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF URL の flid パラメータを externalId に使用
  const flidMatch = params.pdfUrl.match(/[?&]flid=(\d+)/);
  const idMatch = params.pdfUrl.match(/[?&]id=(\d+)/);
  const externalId =
    flidMatch && idMatch
      ? `mifune_${idMatch[1]}_${flidMatch[1]}`
      : `mifune_${encodeURIComponent(params.pdfUrl)}`;

  return {
    municipalityId,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
