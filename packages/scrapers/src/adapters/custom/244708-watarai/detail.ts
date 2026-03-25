/**
 * 度会町議会 -- detail フェーズ
 *
 * 会議録 PDF をダウンロードし、テキストを抽出して MeetingData を組み立てる。
 *
 * PDF 構造:
 *   - 冒頭に「令和X年第N回度会町議会定例会会議録」タイトル
 *   - 招集年月日: 「招集年月日\n令和X年X月X日」
 *   - 発言者行: 「○役職（氏名）」または「○N番（氏名）」
 *   - 議事区切り: 「◎...」で始まる行
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, parseWarekiYear } from "./shared";

export type WataraiDetailParams = {
  title: string;
  meetingType: string;
  pdfUrl: string;
  year: number;
  sessionNumber: number | null;
  frmId: number;
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
 * 発言者行を解析する。
 *
 * 度会町の発言者パターン:
 *   ○議長（若宮　淳也）
 *   ○町長（中村　忠彦）
 *   ○１番（山北　佳宏）
 *
 * 括弧は全角「（）」を使用。
 */
export function parseSpeakerLine(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  isHeader: boolean;
} {
  // ○ で始まる発言者行
  if (!line.startsWith("○")) {
    return { speakerName: null, speakerRole: null, isHeader: false };
  }

  const inner = line.slice(1).trim();

  // パターン: ○役職（氏名）または ○N番（氏名）
  const speakerMatch = inner.match(/^(.+?)（(.+?)）/);
  if (!speakerMatch) {
    return { speakerName: null, speakerRole: null, isHeader: true };
  }

  const rolePart = speakerMatch[1]!.trim();
  const namePart = speakerMatch[2]!.trim();

  // 番号付き議員: ○N番（氏名）
  if (/^[\d０-９]+番$/.test(rolePart)) {
    return { speakerName: namePart, speakerRole: "議員", isHeader: true };
  }

  // 役職パターン
  return { speakerName: namePart, speakerRole: rolePart, isHeader: true };
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
 * 招集年月日の後に来る和暦日付を抽出する。
 * 例: "招集年月日\n\n令和７年３月４日" -> "2025-03-04"
 */
export function parseHeldOn(text: string): string | null {
  const toHankaku = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  const normalized = toHankaku(text);

  // 招集年月日パターンを優先的に探す
  const shoshuPattern = /招集年月日[\s\S]{0,20}?((?:令和|平成)\s*(?:\d+|元)\s*年)\s*(\d+)\s*月\s*(\d+)\s*日/;
  const mShoshu = normalized.match(shoshuPattern);
  if (mShoshu) {
    const seirekiYear = parseWarekiYear(mShoshu[1]!);
    if (seirekiYear) {
      const month = parseInt(mShoshu[2]!, 10);
      const day = parseInt(mShoshu[3]!, 10);
      if (!isNaN(month) && !isNaN(day)) {
        return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // 開議パターン: 開議\n令和X年X月X日
  const kaigiPattern = /開議[\s\S]{0,20}?((?:令和|平成)\s*(?:\d+|元)\s*年)\s*(\d+)\s*月\s*(\d+)\s*日/;
  const mKaigi = normalized.match(kaigiPattern);
  if (mKaigi) {
    const seirekiYear = parseWarekiYear(mKaigi[1]!);
    if (seirekiYear) {
      const month = parseInt(mKaigi[2]!, 10);
      const day = parseInt(mKaigi[3]!, 10);
      if (!isNaN(month) && !isNaN(day)) {
        return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  // フォールバック: テキスト内の最初の和暦日付
  const mFull = normalized.match(
    /((?:令和|平成)\s*(?:\d+|元)\s*年)\s*(\d+)\s*月\s*(\d+)\s*日/
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
 * 役職サフィックスなしの一般テキストから発言者情報を抽出する（フォールバック）。
 */
function parseSpeakerFallback(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const spaceIdx = text.search(/[\s　]/);
  if (spaceIdx === -1) {
    return { speakerName: null, speakerRole: null, content: text };
  }

  const headerCandidate = text.slice(0, spaceIdx);
  const rest = text.slice(spaceIdx).trim();

  if (!rest) {
    return { speakerName: null, speakerRole: null, content: text };
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (headerCandidate.endsWith(suffix)) {
      const name =
        headerCandidate.length > suffix.length ? headerCandidate.slice(0, -suffix.length) : null;
      return { speakerName: name, speakerRole: suffix, content: rest };
    }
  }

  return { speakerName: null, speakerRole: null, content: text };
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 度会町の会議録は ○発言者行 + 発言内容 の構造を持つ。
 * ◎ で始まる行は議事区切りとして remark として扱う。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const lines = text.split("\n");
  const statements: ParsedStatement[] = [];
  let offset = 0;

  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let contentLines: string[] = [];

  function flushStatement() {
    const content = contentLines
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .trim();
    contentLines = [];

    if (!content || content.length < 5) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeakerRole),
      speakerName: currentSpeakerName,
      speakerRole: currentSpeakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ◎ で始まる議事区切り行
    if (trimmed.startsWith("◎")) {
      flushStatement();
      currentSpeakerName = null;
      currentSpeakerRole = null;

      const sectionText = trimmed.slice(1).trim();
      if (sectionText.length >= 3) {
        const contentHash = createHash("sha256").update(sectionText).digest("hex");
        const startOffset = offset;
        const endOffset = offset + sectionText.length;
        statements.push({
          kind: "remark",
          speakerName: null,
          speakerRole: null,
          content: sectionText,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      }
      continue;
    }

    // ○ で始まる発言者行
    if (trimmed.startsWith("○")) {
      flushStatement();
      const { speakerName, speakerRole } = parseSpeakerLine(trimmed);
      currentSpeakerName = speakerName;
      currentSpeakerRole = speakerRole;

      // 発言者行の後のテキスト（同一行内に発言内容がある場合）
      const afterSpeaker = trimmed.replace(/^○.+?）/, "").trim();
      if (afterSpeaker) {
        contentLines.push(afterSpeaker);
      }
      continue;
    }

    // 通常テキスト行
    contentLines.push(trimmed);
  }

  // 最後のブロックをフラッシュ
  flushStatement();

  // ○発言者行パターンで抽出できなかった場合のフォールバック
  if (statements.length === 0) {
    const blocks = text.split(/\n{2,}/);
    offset = 0;
    for (const block of blocks) {
      const normalized = block.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
      if (!normalized || normalized.length < 5) continue;

      const { speakerName, speakerRole, content } = parseSpeakerFallback(normalized);
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
      `[244708-watarai] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: WataraiDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOn(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: frmId + PDF ファイル名
  const pdfFileName = new URL(params.pdfUrl).pathname.split("/").pop() ?? "";
  const externalId = `watarai_${params.frmId}_${pdfFileName}`;

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
