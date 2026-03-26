/**
 * せたな町議会 会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を解析して MeetingData を返す。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, detectMeetingType, parseJapaneseDate, toHalfWidth } from "./shared";
import type { SetanaPdfRecord } from "./list";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
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
 * フォーマット例:
 *   「〇議長（山田太郎）」
 *   「〇３番（鈴木花子）」
 *   「〇町長（佐藤一郎）」
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 先頭の〇マーカーを除去
  const stripped = text.replace(/^[〇○◯◎●]\s*/, "");

  // パターン1: 「役職（名前）」形式（典型パターン）
  // 例: 「議長（山田太郎）」「３番（鈴木花子）」
  const bracketMatch = stripped.match(
    /^(.+?)（(.+?)）[\s　]*([\s\S]*)/,
  );
  if (bracketMatch) {
    const roleOrNum = bracketMatch[1]?.trim() ?? "";
    const name = bracketMatch[2]?.trim() ?? null;
    const content = bracketMatch[3]?.trim() ?? "";

    // roleOrNum が数字のみの場合（「３番」など）
    const halfNum = toHalfWidth(roleOrNum);
    if (/^\d+番$/.test(halfNum)) {
      return { speakerName: name, speakerRole: halfNum, content };
    }

    // 役職サフィックスにマッチするか確認
    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrNum === suffix || roleOrNum.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    // それ以外: roleOrNum を役職として扱う
    return { speakerName: name, speakerRole: roleOrNum || null, content };
  }

  // パターン2: 「名前役職 本文」形式
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (headerMatch?.[1]) {
    const header = headerMatch[1];
    const content = stripped.slice(headerMatch[0].length).trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    if (/^[〇○◯◎●]/.test(text)) {
      return { speakerName: header, speakerRole: null, content };
    }
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
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function extractDateFromText(text: string): string | null {
  return parseJapaneseDate(text);
}

/**
 * PDF テキストから会議タイトルを抽出する。
 * 例: 「令和７年第２回せたな町議会定例会」
 */
export function extractTitleFromText(text: string): string | null {
  const m = text.match(
    /(令和|平成|昭和)(元|[０-９\d]+)年第[０-９\d]+回せたな町議会(定例会|臨時会)[^\n]*/,
  );
  if (m) return m[0].trim();

  // 委員会タイトル
  for (const line of text.split(/\n/)) {
    const normalized = line.replace(/\s+/g, "");
    if (
      normalized.endsWith("常任委員会") ||
      normalized.endsWith("特別委員会") ||
      normalized === "合同委員会"
    ) {
      return normalized.trim();
    }
  }

  return null;
}

/**
 * PDF テキストから発言リストをパースする。
 * せたな町は〇マーカー行が話者を示す。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split(/\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!.trim();
    i++;

    if (!line) continue;

    // 〇マーカー行
    if (/^[〇○◯◎●]/.test(line)) {
      // 次の〇マーカーまでの続きの行を結合する
      let fullText = line;
      while (i < lines.length) {
        const nextLine = lines[i]!.trim();
        if (!nextLine) {
          i++;
          continue;
        }
        if (/^[〇○◯◎●]/.test(nextLine)) break;
        // 議事日程や見出しっぽい行は連結しない
        if (/^[０-９\d]+[．\.]/.test(nextLine)) break;
        fullText += "　" + nextLine;
        i++;
      }

      const { speakerName, speakerRole, content } = parseSpeaker(fullText);
      if (!content) continue;

      const normalized = content.replace(/\s+/g, " ").trim();
      if (!normalized) continue;

      const contentHash = createHash("sha256").update(normalized).digest("hex");
      const startOffset = offset;
      const endOffset = offset + normalized.length;
      statements.push({
        kind: classifyKind(speakerRole),
        speakerName,
        speakerRole,
        content: normalized,
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
 * PDF バイナリからテキストを抽出する。
 * unpdf を使用する。
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (e) {
    console.warn("[setana] unpdf extractText failed", e);
    return null;
  }
}

/**
 * PDF レコードから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  record: SetanaPdfRecord,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const buffer = await fetchBinary(record.pdfUrl);
  if (!buffer) return null;

  const text = await extractTextFromPdf(buffer);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractDateFromText(text);
  if (!heldOn) return null;

  const extractedTitle = extractTitleFromText(text);
  const title = extractedTitle ?? record.linkText;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: record.pdfUrl,
    externalId: `setana_${createHash("sha256").update(record.pdfUrl).digest("hex").slice(0, 16)}`,
    statements,
  };
}
