/**
 * おいらせ町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * おいらせ町の PDF は ○ マーカーを使わず、以下の形式で発言が記録される:
 *   「役職 （名前君） content」例: 「事務局長 （佐々木拓仁君） おはようございます。」
 *   「名前役職 content」例: 「松林議長 ただいまの出席議員数は...」
 *   「番号 （名前君） content」例: 「１４番 （西館芳信君） 皆様、おはようございます。」
 *
 * 「発 言 者 の 要 旨」ヘッダーの後の本文から発言を抽出する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OiraseDocument } from "./list";
import { detectMeetingType, fetchBinary, parseJapaneseDate } from "./shared";
import { extractYearFromTitle, parseDateFromRow } from "./list";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
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
  "事務局次長",
  "事務局長",
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
  "事務局長",
  "事務局次長",
]);

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
 * 発言ヘッダーの役職部分から speakerRole を解析する。
 */
export function resolveRole(rolePart: string): string | null {
  // 番号付き議員: 「１４番」
  if (/^[\d０-９]+番/.test(rolePart.trim())) {
    return "議員";
  }

  // 役職マッチ（長い順に照合）
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return suffix;
    }
  }

  return rolePart.trim() || null;
}

/**
 * PDF テキストから「発言者の要旨」ブロックを抽出する。
 * テキストに「発 言 者 の 要 旨」が含まれる場合はその後の本文を返す。
 * 含まれない場合はテキスト全体を返す。
 */
export function extractBodyText(text: string): string {
  const headerMatch = text.match(/発\s*言\s*者\s*の\s*要\s*旨/);
  if (headerMatch && headerMatch.index !== undefined) {
    return text.slice(headerMatch.index + headerMatch[0].length);
  }
  return text;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * statements が空の場合は空配列を返す。
 *
 * おいらせ町の PDF は「役職 （名前君） content」形式で発言が記録される。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const bodyText = extractBodyText(text);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 発言ヘッダーパターン: 「役職 （名前君）」または「番号 （名前君）」
  const SPEAKER_BLOCK_REGEX =
    /((?:[\d０-９]+番|[^\s　（）\n]{1,15})\s*（([^）]{1,20})君）)\s*/g;

  // 全発言ヘッダーの位置を収集
  // match[1] = 「役職 （名前君）」全体, match[2] = 名前部分
  // rolePartは「役職」部分のみ（「（」の前）
  const speakerBlocks: Array<{
    index: number;
    fullMatch: string;
    rolePart: string;
    name: string;
  }> = [];

  for (const match of bodyText.matchAll(SPEAKER_BLOCK_REGEX)) {
    const fullHeader = (match[1] ?? "").trim();
    // 「（」の前の部分が役職
    const rolePartRaw = fullHeader.split("（")[0]?.trim() ?? fullHeader;
    const name = (match[2] ?? "").replace(/[\s　]+/g, "").trim();
    speakerBlocks.push({
      index: match.index!,
      fullMatch: match[0],
      rolePart: rolePartRaw,
      name,
    });
  }

  for (let i = 0; i < speakerBlocks.length; i++) {
    const block = speakerBlocks[i]!;
    const contentStart = block.index + block.fullMatch.length;
    const nextBlock = speakerBlocks[i + 1];
    const contentEnd = nextBlock?.index ?? bodyText.length;

    const rawContent = bodyText
      .slice(contentStart, contentEnd)
      // 【...】ページ番号表記を除去（全角・半角ダッシュ、全角数字に対応）
      .replace(/【[^】]+】\s*[－-][０-９\d]+[－-]\s*/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!rawContent) continue;

    const speakerRole = resolveRole(block.rolePart);
    const speakerName = block.name || null;

    const contentHash = createHash("sha256").update(rawContent).digest("hex");
    const startOffset = offset;
    const endOffset = offset + rawContent.length;
    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content: rawContent,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  return statements;
}

/**
 * PDF テキストから開会日を抽出する。
 * 「令和X年X月X日」パターンを探す。
 * 解析できない場合は null を返す。
 */
export function extractHeldOn(text: string): string | null {
  const dateMatch = text.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return null;
  return parseJapaneseDate(dateMatch[0]);
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
      `[024121-oirase] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  doc: OiraseDocument,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(doc.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // heldOn: まず rawDateText から、次に PDF テキストから抽出
  let heldOn: string | null = null;

  if (doc.rawDateText) {
    const yearContext = extractYearFromTitle(doc.title);
    if (yearContext !== null) {
      heldOn = parseDateFromRow(doc.rawDateText, yearContext);
    }
  }

  if (!heldOn) {
    heldOn = extractHeldOn(text);
  }

  if (!heldOn) return null;

  // PDF ファイル名から externalId を生成
  const filenameMatch = doc.pdfUrl.match(/\/([^/]+)\.pdf$/i);
  const filename = filenameMatch?.[1] ?? null;
  const externalId = filename ? `oirase_${filename}` : null;

  return {
    municipalityId,
    title: doc.title,
    meetingType: detectMeetingType(doc.title),
    heldOn,
    sourceUrl: doc.pdfUrl,
    externalId,
    statements,
  };
}
