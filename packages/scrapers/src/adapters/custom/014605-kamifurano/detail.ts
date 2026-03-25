/**
 * 上富良野町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードし、テキストを抽出して発言を構造化する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, parseWarekiDate } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
  "委員長",
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
  "書記",
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
  "書記",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 * フォーマット例: "○田中議長 ただいまから会議を開きます。"
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 先頭の名前+役職部分を取得（スペースまで）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = stripped.slice(headerMatch[0].length).trim();

  // 役職サフィックスにマッチする場合: "田中議長" → name=田中, role=議長
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
  speakerRole: string | null,
): "remark" | "answer" | "question" {
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
 * PDF テキストから発言を抽出する。
 * ◯マーカーで始まる行を発言として処理する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 行に分割して処理
  const lines = text.split(/\n/);
  let currentSpeaker: {
    name: string | null;
    role: string | null;
  } | null = null;
  let contentLines: string[] = [];

  function flushStatement() {
    if (contentLines.length === 0) return;
    const content = contentLines.join(" ").replace(/\s+/g, " ").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(currentSpeaker?.role ?? null),
      speakerName: currentSpeaker?.name ?? null,
      speakerRole: currentSpeaker?.role ?? null,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    contentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hasMarker = /^[○◯◎●]/.test(trimmed);

    if (hasMarker) {
      // 前の発言を確定
      flushStatement();

      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeaker = { name: speakerName, role: speakerRole };
      if (content) {
        contentLines.push(content);
      }
    } else {
      // 継続行または地の文
      if (currentSpeaker !== null) {
        contentLines.push(trimmed);
      } else if (trimmed.length > 10) {
        // 話者なしのテキストブロック（休憩宣言など）
        flushStatement();
        currentSpeaker = null;
        contentLines.push(trimmed);
        flushStatement();
      }
    }
  }

  // 最後の発言を確定
  flushStatement();

  return statements;
}

/**
 * PDF URL からテキストを抽出し、発言を返す。
 */
export async function fetchPdfStatements(
  pdfUrl: string,
): Promise<ParsedStatement[] | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: extracted } = await extractText(pdf, { mergePages: true });
    text = extracted;
  } catch (e) {
    console.warn(`[kamifurano] PDF テキスト抽出失敗: ${pdfUrl}`, e);
    return null;
  }

  const statements = parseStatements(text);
  return statements.length > 0 ? statements : null;
}

/**
 * PDF ドキュメント情報から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: {
    pdfUrl: string;
    title: string;
    rawDate: string | null;
    meetingType: string;
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  const statements = await fetchPdfStatements(doc.pdfUrl);
  if (!statements) return null;

  const heldOn = doc.rawDate ? parseWarekiDate(doc.rawDate) : null;
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: doc.title,
    meetingType: doc.meetingType,
    heldOn,
    sourceUrl: doc.pdfUrl,
    externalId: `kamifurano_${encodeURIComponent(doc.pdfUrl)}`,
    statements,
  };
}
