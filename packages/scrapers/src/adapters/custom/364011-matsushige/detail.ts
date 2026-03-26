/**
 * 松茂町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言ブロックを分割して
 * ParsedStatement 配列を生成する。
 *
 * 松茂町の PDF は会議録本文を含む。発言者は以下のパターンで現れる:
 *   ○ 議長氏名 ただいまから…
 *   ○ 町長氏名 お答えします…
 *   ○ 議員氏名議員 質問します…
 *
 * ○マーカー付き発言と、改行で区切られたブロックで処理する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";
import type { MatsushigePdfRecord } from "./list";

export interface MatsushigeDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
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
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "監査委員",
  "議員",
  "委員",
] as const;

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
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "監査委員",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 対応パターン:
 *   ○ 議長名議長 ただいまから…
 *   ○ 氏名町長 お答えします…
 *   ○ 氏名議員 質問します…
 *   ○ 氏名 発言内容…（役職不明）
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○マーカーを除去
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 先頭の名前+役職部分を取得（スペースまで）
  const spaceIdx = stripped.search(/[\s　]/);
  if (spaceIdx === -1) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = stripped.slice(0, spaceIdx);
  const content = stripped.slice(spaceIdx).trim();

  if (!content) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  // 役職サフィックスにマッチする場合
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length ? header.slice(0, -suffix.length) : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  // ○マーカーがある場合、役職が不明でも先頭を名前として扱う
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
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * ○マーカーで始まる行を発言の区切りとして処理する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 行に分割して処理
  const lines = text.split(/\r?\n/);
  let currentBlock: string[] = [];
  let inSpeech = false;

  const flushBlock = () => {
    if (currentBlock.length === 0) return;

    const normalized = currentBlock
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();

    currentBlock = [];
    if (!normalized || normalized.length < 5) return;

    const hasMarker = /^[○◯◎●]/.test(normalized);

    if (hasMarker) {
      const { speakerName, speakerRole, content } = parseSpeaker(normalized);
      if (!content || content.length < 3) return;

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
    } else if (normalized.length > 10) {
      const contentHash = createHash("sha256").update(normalized).digest("hex");
      const startOffset = offset;
      const endOffset = offset + normalized.length;
      statements.push({
        kind: "remark",
        speakerName: null,
        speakerRole: null,
        content: normalized,
        contentHash,
        startOffset,
        endOffset,
      });
      offset = endOffset + 1;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^[○◯◎●]/.test(trimmed)) {
      // 新しい発言ブロックの開始
      flushBlock();
      currentBlock = [trimmed];
      inSpeech = true;
    } else if (inSpeech) {
      currentBlock.push(trimmed);
    }
    // 発言開始前の行（表紙・日時等）は無視
  }

  flushBlock();

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
      `[364011-matsushige] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: MatsushigeDetailParams,
  municipalityCode: string
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: PDF URL のパス部分（ファイル名）を使用
  const pdfPath = new URL(params.pdfUrl).pathname.split("/").pop() ?? "";
  const externalId = `matsushige_${pdfPath.replace(/\.pdf$/i, "")}`;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}

/** MatsushigePdfRecord を MatsushigeDetailParams に変換する */
export function toDetailParams(
  record: MatsushigePdfRecord
): MatsushigeDetailParams {
  return {
    title: record.title,
    heldOn: record.heldOn,
    pdfUrl: record.pdfUrl,
    meetingType: record.meetingType,
  };
}
