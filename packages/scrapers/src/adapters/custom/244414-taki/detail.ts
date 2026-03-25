/**
 * 多気町議会 -- detail フェーズ
 *
 * 一般質問会議録 PDF をダウンロードし、テキストを抽出して MeetingData を組み立てる。
 *
 * PDF からテキストを抽出して ParsedStatement 配列を生成する。
 * 開催日は PDF 本文の冒頭から抽出する（解析できない場合は null を返す）。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, parseWarekiYear } from "./shared";
import type { TakiPdfRecord } from "./list";

export type TakiDetailParams = {
  title: string;
  meetingType: string;
  pdfUrl: string;
  year: number;
  sessionNumber: number | null;
  yearPageUrl: string;
};

// 役職サフィックス（長い方を先に配置して誤マッチを防ぐ）
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
  "政策監",
  "管理者",
  "監査委員",
  "議員",
  "委員",
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
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "監査委員",
  "事務局長",
]);

/**
 * テキストから発言者情報を抽出する。
 *
 * 対応パターン:
 *   「氏名議員」「氏名町長」「N番 氏名議員」
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 「日程第X」等のプレフィックスを除去
  let normalized = text.trim().replace(/^(?:日程第[\d０-９一二三四五六七八九十百千]+\s+)+/, "");

  const spaceIdx = normalized.search(/[\s　]/);
  if (spaceIdx === -1) {
    return { speakerName: null, speakerRole: null, content: normalized };
  }

  const headerCandidate = normalized.slice(0, spaceIdx);
  const rest = normalized.slice(spaceIdx).trim();

  if (!rest) {
    return { speakerName: null, speakerRole: null, content: normalized };
  }

  // パターン1: 「N番」で始まる場合
  if (/^[\d０-９]+番$/.test(headerCandidate)) {
    const spaceIdx2 = rest.search(/[\s　]/);
    if (spaceIdx2 === -1) {
      return { speakerName: null, speakerRole: null, content: normalized };
    }
    const nameRole = rest.slice(0, spaceIdx2);
    const content = rest.slice(spaceIdx2).trim();
    if (!content) {
      return { speakerName: null, speakerRole: null, content: normalized };
    }
    for (const suffix of ROLE_SUFFIXES) {
      if (nameRole.endsWith(suffix)) {
        const name = nameRole.length > suffix.length ? nameRole.slice(0, -suffix.length) : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
    return { speakerName: nameRole, speakerRole: null, content };
  }

  // パターン2: 「氏名役職 発言内容」
  for (const suffix of ROLE_SUFFIXES) {
    if (headerCandidate.endsWith(suffix)) {
      const name =
        headerCandidate.length > suffix.length ? headerCandidate.slice(0, -suffix.length) : null;
      return { speakerName: name, speakerRole: suffix, content: rest };
    }
  }

  return { speakerName: null, speakerRole: null, content: normalized };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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
 * PDF から抽出したテキストの冒頭から開催日を解析する。
 *
 * 例:
 *   "令和6年3月4日" → "2024-03-04"
 *   "令和６年３月４日" → "2024-03-04"（全角数字も対応）
 *
 * 解析できない場合は null を返す。
 */
export function parseHeldOn(text: string): string | null {
  const toHankaku = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  const normalized = toHankaku(text);

  // パターン: 和暦年 + 月日（例: 令和6年3月4日）
  const mFull = normalized.match(
    /([令平昭][和成和]\s*(?:\d+|元)\s*年)\s*(\d+)\s*月\s*(\d+)\s*日/
  );
  if (mFull) {
    const seirekiYear = parseWarekiYear(mFull[1]!);
    if (seirekiYear) {
      const month = parseInt(mFull[2]!, 10);
      const day = parseInt(mFull[3]!, 10);
      if (!isNaN(month) && !isNaN(day)) {
        return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 空行区切りでブロックを分割し、各ブロックを statement として抽出する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 空行で段落に分割（2行以上の連続改行を区切りとする）
  const blocks = text.split(/\n{2,}/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    // 複数の改行・スペースを単一スペースに正規化
    const normalized = block.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!normalized || normalized.length < 5) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content || content.length < 5) continue;

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
      `[244414-taki] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: TakiDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOn(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: yearPageUrl の末尾 ID + pdfUrl のファイル名
  const yearPageId = params.yearPageUrl.replace(/\/$/, "").split("/").pop() ?? "";
  const pdfFileName = new URL(params.pdfUrl).pathname.split("/").pop() ?? "";
  const externalId = `taki_${yearPageId}_${pdfFileName}`;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}

/** TakiPdfRecord を TakiDetailParams に変換する型ヘルパー */
export function toDetailParams(record: TakiPdfRecord): TakiDetailParams {
  return {
    title: record.title,
    meetingType: record.meetingType,
    pdfUrl: record.pdfUrl,
    year: record.year,
    sessionNumber: record.sessionNumber,
    yearPageUrl: record.yearPageUrl,
  };
}
