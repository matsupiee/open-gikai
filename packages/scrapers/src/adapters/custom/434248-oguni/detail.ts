/**
 * 小国町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（○マーカーなし、インライン形式）:
 *   議長（熊谷博行君） ただいまから会議を開きます。
 *   町長（渡邉誠次君） お答えいたします。
 *   ４番（児玉智博君） 質問いたします。
 *   総務課長（佐藤則和君） ご説明いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OguniMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
  "参事",
  "主幹",
  "主査",
  "補佐",
  "事務局長",
]);

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   議長（熊谷博行君）　→ role=議長, name=熊谷博行
 *   町長（渡邉誠次君）　→ role=町長, name=渡邉誠次
 *   ４番（児玉智博君）　→ role=議員, name=児玉智博
 *   総務課長（佐藤則和君）→ role=課長, name=佐藤則和
 *   教育委員会事務局長（久野由美君）→ role=事務局長, name=久野由美
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○ マーカーがある場合は除去（テスト互換性のため）
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員|氏）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員|氏)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ４番（児玉智博君）or ○１番（佐藤花子君）
    if (/^[○◯◎●]?[\d０-９]+番$/.test(rolePart.replace(/^[○◯◎●]\s*/, ""))) {
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

  // カッコパターンに合致しない場合
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
 * 小国町の PDF は ○ マーカーなしのインライン形式:
 * 「議長（熊谷博行君） テキスト。 町長（渡邉誠次君） テキスト。」
 */
export function parseStatements(text: string): ParsedStatement[] {
  // まず ○ マーカーがある形式を試す（テスト互換性のため）
  const hasCircleMarkers = /[○◯◎●]/.test(text);

  if (hasCircleMarkers) {
    return parseStatementsWithMarkers(text);
  }

  return parseStatementsInline(text);
}

/**
 * ○ マーカー付き形式のパース（テスト用）
 */
function parseStatementsWithMarkers(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
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
 * インライン形式のパース（小国町の実際のPDF形式）
 * 「議長（名前君） テキスト。 町長（名前君） テキスト。」
 */
function parseStatementsInline(text: string): ParsedStatement[] {
  // 発言ヘッダーのマッチを収集
  // パターン: 役名（名前+君/様/議員/氏）
  const headerPattern = /([^\s（(。、　\n]{1,20})[（(]([^）)]+(?:君|様|議員|氏))[）)]/g;

  const headers: { index: number; rolePart: string; namePart: string }[] = [];

  for (const match of text.matchAll(headerPattern)) {
    const rolePart = match[1]!.trim();
    const namePart = match[2]!.replace(/(?:君|様|議員|氏)$/, "").trim();

    // 役職または番号付き議員かチェック
    const isNumberedMember = /^[\d０-９]+番$/.test(rolePart);
    const isRole = ROLE_SUFFIXES.some(
      (suffix) => rolePart === suffix || rolePart.endsWith(suffix)
    );

    if (!isNumberedMember && !isRole) continue;

    // 前の文字が特定の区切り文字（改行・スペース・句点・読点など）または文頭の場合のみ
    const precedingChar: string | null =
      match.index! > 0 ? (text[match.index! - 1] ?? null) : null;
    if (
      precedingChar !== null &&
      !/[\s　。、\n\r（(]/.test(precedingChar) &&
      !headers.some((h) => h.index + 1 === match.index)
    ) {
      // 直前が文字の途中の場合はスキップ（議事録本文中の人名参照など）
      // ただし直前が番号（「１番」等）の末尾の場合はよい
      if (!/[0-9０-９]/.test(precedingChar)) {
        continue;
      }
    }

    headers.push({ index: match.index!, rolePart, namePart });
  }

  if (headers.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < headers.length; i++) {
    const current = headers[i]!;
    const next = headers[i + 1];

    // ヘッダー終端（名前と君/様/議員/氏と閉じカッコの後）
    const headerEndMatch = text
      .slice(current.index)
      .match(/^[^\s）)]*[）)]\s*/);
    const headerLength = headerEndMatch ? headerEndMatch[0]!.length : 0;
    const contentStart = current.index + headerLength;
    const contentEnd = next ? next.index : text.length;

    const rawContent = text.slice(contentStart, contentEnd).trim();
    if (!rawContent) continue;

    // 内容を正規化
    const content = rawContent.replace(/\s+/g, " ").trim();
    if (!content) continue;

    // 役職を特定
    const { speakerRole, speakerName } = resolveSpeaker(
      current.rolePart,
      current.namePart
    );

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
 * rolePart と namePart から speakerName と speakerRole を解決する。
 */
function resolveSpeaker(
  rolePart: string,
  namePart: string
): { speakerName: string | null; speakerRole: string | null } {
  const rawName = namePart.replace(/[\s　]+/g, "").trim() || null;

  // 番号付き議員: ４番
  if (/^[\d０-９]+番$/.test(rolePart)) {
    return { speakerName: rawName, speakerRole: "議員" };
  }

  // 役職マッチ
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return { speakerName: rawName, speakerRole: suffix };
    }
  }

  return { speakerName: rawName, speakerRole: rolePart || null };
}

/**
 * PDF URL からハッシュ値（externalId 用）を抽出する。
 * e.g., "/resource.php?e=abc123def456" → "abc123def456"
 */
function extractHashFromUrl(url: string): string | null {
  const match = url.match(/[?&]e=([^&]+)/);
  return match ? match[1]! : null;
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
      `[434248-oguni] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF テキストから開催日 (YYYY-MM-DD) を抽出する。
 * 「令和X年Y月Z日」パターンにマッチする最初の日付を返す。
 * 全角数字にも対応する。
 */
export function extractHeldOnFromText(text: string, _titleYear?: number): string | null {
  // 全角数字を半角に変換してから処理
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OguniMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = extractHeldOnFromText(text, meeting.year);
  if (!heldOn) return null;

  const hash = extractHashFromUrl(meeting.pdfUrl);
  const externalId = hash ? `oguni_${hash}` : null;

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
