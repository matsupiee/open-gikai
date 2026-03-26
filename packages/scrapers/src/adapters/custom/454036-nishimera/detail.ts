/**
 * 西米良村議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 西米良村の会議録 PDF は○マーカーで発言者を区切る形式:
 *   ○議長（田中太郎君）　ただいまから会議を開きます。
 *   ○１番（鈴木一郎君）　質問いたします。
 *   ○村長（山田花子君）　お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NishimeraMeeting } from "./list";
import {
  convertJapaneseEra,
  extractExternalId,
  fetchBinary,
} from "./shared";
import { parseHeldOnFromText } from "./list";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
  "代表監査委員",
  "監査委員",
  "会計管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
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
  "事務局長",
  "代表監査委員",
  "監査委員",
  "会計管理者",
]);

/**
 * ○ マーカー付き発言ブロックから発言者情報と内容を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中太郎君）　ただいまから会議を…  → role=議長, name=田中太郎
 *   ○１番（鈴木一郎君）　質問いたします。     → role=議員, name=鈴木一郎
 *   ○村長（山田花子君）　お答えします。        → role=村長, name=山田花子
 *   ○総務課長　報告します。                    → role=課長, name=総務
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: {number}番（{name}君|議員|様）content
  const numberBracketMatch = stripped.match(
    /^[\d０-９]+番[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (numberBracketMatch) {
    const name = numberBracketMatch[1]!.trim().replace(/\s+/g, "");
    const content = numberBracketMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // パターン2: {role}（{name}君|議員|様）content
  const roleBracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (roleBracketMatch) {
    const rolePart = roleBracketMatch[1]!.trim();
    const name = roleBracketMatch[2]!.trim().replace(/\s+/g, "");
    const content = roleBracketMatch[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: name, speakerRole: rolePart || null, content };
  }

  // パターン3: {name}{role} content (e.g., 山田総務課長 ...)
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    if (/^[○◯◎●]/.test(text)) {
      return { speakerName: header, speakerRole: null, content };
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
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
 * PDF テキストから開催日を抽出する。
 */
export function parseDateFromPdfText(
  text: string,
  year: number,
): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 「令和/平成N年N月N日」パターン
  const dateMatch = normalized.match(
    /(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (dateMatch) {
    const convertedYear = convertJapaneseEra(dateMatch[1]!, dateMatch[2]!);
    if (!convertedYear) return null;
    const month = parseInt(dateMatch[3]!, 10);
    const day = parseInt(dateMatch[4]!, 10);
    return `${convertedYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 「N月N日」パターン（年は context から）
  const monthDayMatch = normalized.match(/(\d+)月(\d+)日/);
  if (monthDayMatch) {
    const month = parseInt(monthDayMatch[1]!, 10);
    const day = parseInt(monthDayMatch[2]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * PDF テキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ: ○...（...登壇）や ○...（...退席）のような形式
    if (/^[○◯◎●].+?[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
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
      `[454036-nishimera] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: NishimeraMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日: PDFテキストから抽出、なければリンクテキストから、どちらもなければ null
  const heldOn =
    parseDateFromPdfText(text, meeting.year) ??
    parseHeldOnFromText(meeting.linkText, meeting.year) ??
    null;

  if (!heldOn) return null;

  const externalId = extractExternalId(meeting.pdfUrl);

  return {
    municipalityCode,
    title: meeting.linkText,
    meetingType: meeting.meetingType,
    heldOn,
    sourceUrl: meeting.articleUrl,
    externalId,
    statements,
  };
}
