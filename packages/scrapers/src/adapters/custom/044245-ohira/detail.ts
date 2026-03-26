/**
 * 大衡村議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   議長（髙橋浩之君）
 *   村長（小川ひろみ君）
 *   税務課長（堀籠淳君）
 *   10番（佐々木金彌君）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OhiraMeeting } from "./list";
import { detectMeetingType, fetchBinary, toHankaku } from "./shared";

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

/**
 * 発言者行から発言者情報を抽出する。
 *
 * 対応パターン（docs/custom-scraping/ohira.md より）:
 *   議長（髙橋浩之君）　 → role=議長, name=髙橋浩之
 *   村長（小川ひろみ君）　 → role=村長, name=小川ひろみ
 *   税務課長（堀籠淳君）　 → role=課長, name=堀籠淳
 *   10番（佐々木金彌君）　 → role=議員, name=佐々木金彌
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 発言者パターン: role（name君）content
  const match = text.match(/^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: 10番（佐々木金彌君）
    const normalizedRole = toHankaku(rolePart);
    if (/^\d+番$/.test(normalizedRole)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  return { speakerName: null, speakerRole: null, content: text.trim() };
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
 * 大衡村の会議録は「役職（氏名君）」の形式で発言者が示される。
 * 行単位で処理し、発言者行の次の行から次の発言者行までを発言内容とする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // 行に分割してパース
  const lines = text.split(/\n/);

  // 発言者行のパターン: 先頭に役職（氏名君） が来る行
  const speakerLinePattern = /^(.+?)[（(](.+?)(?:君|様|議員)[）)]/;

  let currentSpeaker: { name: string | null; role: string | null } | null = null;
  let contentLines: string[] = [];
  let offset = 0;

  function flushStatement() {
    if (!currentSpeaker) return;
    const content = contentLines.join(" ").replace(/\s+/g, " ").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(currentSpeaker.role),
      speakerName: currentSpeaker.name,
      speakerRole: currentSpeaker.role,
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

    // ト書き（登壇等）をスキップ
    if (/^[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) continue;

    const speakerMatch = trimmed.match(speakerLinePattern);
    if (speakerMatch) {
      // 直前の発言をフラッシュ
      flushStatement();

      const rolePart = speakerMatch[1]!.trim();
      const rawName = speakerMatch[2]!.replace(/[\s　]+/g, "").trim();

      // 番号付き議員: 10番（佐々木金彌君）
      const normalizedRole = toHankaku(rolePart);
      let resolvedRole: string | null;
      if (/^\d+番$/.test(normalizedRole)) {
        resolvedRole = "議員";
      } else {
        resolvedRole = rolePart;
        for (const suffix of ROLE_SUFFIXES) {
          if (rolePart === suffix || rolePart.endsWith(suffix)) {
            resolvedRole = suffix;
            break;
          }
        }
      }

      currentSpeaker = { name: rawName, role: resolvedRole };

      // 発言者行の後のテキスト（同一行の残り）を content の開始とする
      const afterSpeaker = trimmed
        .replace(speakerLinePattern, "")
        .replace(/^[\s　]+/, "")
        .trim();
      contentLines = afterSpeaker ? [afterSpeaker] : [];
    } else {
      if (currentSpeaker) {
        contentLines.push(trimmed);
      }
    }
  }

  // 最後の発言をフラッシュ
  flushStatement();

  return statements;
}

/**
 * PDF テキストから開催日を抽出する。
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function extractHeldOnFromPdfText(text: string): string | null {
  const normalized = toHankaku(text);

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2]! === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[044245-ohira] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OhiraMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから開催日を抽出（list フェーズで取得できなかった場合のフォールバック）
  const heldOn = meeting.heldOn ?? extractHeldOnFromPdfText(text);
  if (!heldOn) return null;

  // PDF URL からファイル名部分を取得して外部 ID とする
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop() ?? urlPath;
  const externalId = `ohira_${fileName.replace(".pdf", "")}`;

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
