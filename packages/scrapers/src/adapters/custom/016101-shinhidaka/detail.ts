/**
 * 新ひだか町議会 — detail フェーズ
 *
 * HTML 本文ファイルまたは PDF からテキストを抽出し、
 * 発言を ParsedStatement 配列に変換する。
 *
 * HTML 発言フォーマット（<pre> タグ内）:
 *   〇<b>議長(福嶋尚人君)</b>　おはようございます。
 *   〇<b>町長(大野克之君)</b>　お手元に配付されております...
 *   〇<b>２番(池田一也君)</b>　通告に従い、質問をさせていただきます。
 *   ◎<b>開会の宣告</b>   ← 議事項目見出し（スキップ）
 *
 * PDF 発言フォーマット（unpdf で抽出）:
 *   〇議長（福嶋尚人）　おはようございます。
 *   〇町長（大野克之）　お答えします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShinhidakaMeeting } from "./list";
import {
  eraToWesternYear,
  toHalfWidth,
  detectMeetingType,
  fetchShiftJisPage,
  fetchBinary,
} from "./shared";

// 役職サフィックス（長い方を先に配置して誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "地域包括支援センター長補佐",
  "地域包括支援センター長",
  "企業会計決算審査特別委員長",
  "議会運営委員長",
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
  "書記",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
  "地域包括支援センター長",
  "地域包括支援センター長補佐",
]);

/**
 * 発言者行から話者名・役職・本文を抽出する。
 *
 * 対応パターン（HTML）:
 *   〇<b>議長(福嶋尚人君)</b>　テキスト → role=議長, name=福嶋尚人
 *   〇<b>２番(池田一也君)</b>　テキスト → role=議員, name=池田一也
 *   〇<b>企業会計決算審査特別委員長(池田一也君)</b>　テキスト → role=委員長, name=池田一也
 *
 * 対応パターン（PDF テキスト）:
 *   〇議長（福嶋尚人）　テキスト → role=議長, name=福嶋尚人
 */
export function parseSpeaker(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // HTML タグを除去
  const stripped = line.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // 発言者マーカー（〇 または ○）を除去
  const inner = stripped.replace(/^[〇○]\s*/, "");

  // パターン: 役職(氏名君) または 役職（氏名）
  const bracketMatch = inner.match(/^(.+?)[（(]([^）)]+?)(?:君)?[）)]\s*([\s\S]*)/);
  if (bracketMatch) {
    const rolePart = bracketMatch[1]!.trim();
    const rawName = bracketMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = bracketMatch[3]!.trim();

    // 番号付き議員: "２番" "13番"
    const halfWidthRole = toHalfWidth(rolePart);
    if (/^\d+番$/.test(halfWidthRole)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職サフィックスマッチ（長い方優先）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  return { speakerName: null, speakerRole: null, content: inner.trim() };
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
 * HTML 本文テキストから ParsedStatement 配列を生成する。
 *
 * 〇<b>役職(氏名君)</b> で始まるブロックを発言として抽出する。
 * ◎<b>見出し</b> はスキップする。
 *
 * 発言は <pre> タグの外にも分散しているため、HTML 全体から抽出する。
 */
export function parseHtmlStatements(html: string): ParsedStatement[] {
  // 発言ブロックに分割
  // 〇<b>...</b> で始まるブロックを発言者マーカーとして分割
  const speakerMarker = /(?=〇<b>)/g;
  const blocks = html.split(speakerMarker);

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 〇<b> で始まらないブロックはスキップ
    if (!trimmed.startsWith("〇<b>")) continue;

    // <b> タグの内容と後続テキストを分離
    // 〇<b>役職(氏名君)</b>　本文テキスト...
    const speakerBlockMatch = trimmed.match(/^〇<b>([\s\S]*?)<\/b>\s*([\s\S]*)/i);
    if (!speakerBlockMatch) continue;

    const speakerPart = `〇${speakerBlockMatch[1]!}`;
    const restHtml = speakerBlockMatch[2]!;

    // 次の発言者マーカーまでのテキストを取得
    const contentHtml = restHtml.split(/〇<b>/)[0] ?? restHtml;

    // HTML タグを除去してテキストを整形
    const contentText = contentHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\r\n/g, "\n")
      .trim();

    if (!contentText) continue;

    const { speakerName, speakerRole } = parseSpeaker(speakerPart);
    const contentHash = createHash("sha256").update(contentText).digest("hex");
    const startOffset = offset;
    const endOffset = offset + contentText.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: contentText,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  return statements;
}

/**
 * HTML 本文から開催日を抽出する。
 *
 * 議事日程に "令和６年１２月１０日(火)　午前..." というパターンがある。
 * <pre> タグ内の議事日程から優先的に抽出する。
 */
export function parseDateFromHtml(html: string): string | null {
  // まず <pre> タグ内の議事日程テキストから抽出を試みる
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  const searchText = preMatch ? preMatch[1]! : html;

  const plainText = searchText.replace(/<[^>]+>/g, "");
  const normalized = toHalfWidth(plainText);

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(`${match[1]}${match[2]}年`);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * HTML 本文からタイトルを抽出する。
 *
 * <CENTER><PRE> 内に "令和６年第７回新ひだか町議会定例会会議録" が含まれる。
 * 全角数字も含む。
 */
export function parseTitleFromHtml(html: string): string | null {
  const match = html.match(
    /(?:令和|平成)(?:元|[\d０-９]+)年第[\d０-９]+回新ひだか町議会(?:定例会|臨時会)会議録/,
  );
  if (!match) return null;
  return match[0];
}

/**
 * PDF テキストから ParsedStatement 配列を生成する。
 *
 * 〇マーカーで始まる発言ブロックを抽出する。
 */
export function parsePdfStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[〇○])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[〇○]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[〇○]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    // 議事日程見出し（◎日程第N ...）はスキップ
    if (/^◎/.test(trimmed)) continue;

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
      `[016101-shinhidaka] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * HTML 本文または PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: ShinhidakaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (meeting.format === "html") {
    const html = await fetchShiftJisPage(meeting.sourceUrl);
    if (!html) return null;

    const statements = parseHtmlStatements(html);
    if (statements.length === 0) return null;

    // 開催日は list フェーズで取得したものを優先、取得できなければ HTML から抽出
    const heldOn = meeting.heldOn ?? parseDateFromHtml(html);
    if (!heldOn) return null;

    // タイトルは HTML から取得し、号数を追加
    const baseTitle = parseTitleFromHtml(html) ?? meeting.title;
    const sessionNumMatch = meeting.externalId.match(/_(\d+)$/);
    const sessionNum = sessionNumMatch ? parseInt(sessionNumMatch[1]!, 10) : null;
    const title = sessionNum
      ? `${baseTitle} 第${sessionNum}号`
      : baseTitle;

    return {
      municipalityCode,
      title,
      meetingType: detectMeetingType(title),
      heldOn,
      sourceUrl: meeting.sourceUrl,
      externalId: meeting.externalId,
      statements,
    };
  } else {
    // PDF
    const text = await fetchPdfText(meeting.sourceUrl);
    if (!text) return null;

    const statements = parsePdfStatements(text);
    if (statements.length === 0) return null;

    const heldOn = meeting.heldOn;
    if (!heldOn) return null;

    return {
      municipalityCode,
      title: meeting.title,
      meetingType: detectMeetingType(meeting.title),
      heldOn,
      sourceUrl: meeting.sourceUrl,
      externalId: meeting.externalId,
      statements,
    };
  }
}
