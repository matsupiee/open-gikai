/**
 * 寿都町議会 議会だより — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を解析して MeetingData を返す。
 *
 * 議会だより「寿都湾」は広報紙形式の PDF で、
 * 一般質問のフォーマットは以下の通り:
 *
 *   ■ 質問
 *   {議員名}　議員
 *
 *   {質問タイトル}
 *   {質問本文}
 *
 *   ● 町長
 *   {答弁本文}
 *
 *   ■ 再質問
 *   {再質問本文}
 *
 *   ● 町長
 *   {再答弁本文}
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { SuttuPdfRecord } from "./list";
import { fetchBinary, detectMeetingType, toHalfWidth } from "./shared";

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
  "書記",
]);

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
 * PDF テキストから開催日（発行年月）を抽出する。
 * 発行年月は YYYY-MM-01 形式で返す（日は1日固定）。
 *
 * 優先的に PDF テキストから抽出し、失敗時は record のメタ情報を使用する。
 */
export function extractDateFromText(
  text: string,
  record: { publishYear: number | null; publishMonth: number | null },
): string | null {
  // PDF テキストから年月を抽出
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (match) {
    const [, era, yearPart, monthStr] = match;
    const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);
    const month = parseInt(monthStr!, 10);

    let year: number;
    if (era === "令和") year = eraYear + 2018;
    else if (era === "平成") year = eraYear + 1988;
    else {
      // フォールバック: record のメタ情報
      if (record.publishYear && record.publishMonth) {
        return `${record.publishYear}-${String(record.publishMonth).padStart(2, "0")}-01`;
      }
      return null;
    }

    if (month < 1 || month > 12) return null;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  // フォールバック: record のメタ情報
  if (record.publishYear && record.publishMonth) {
    return `${record.publishYear}-${String(record.publishMonth).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * PDF テキストから会議タイトルを抽出する。
 * 例: "令和7年 第4回定例会" or 議会だより号数を使ったタイトル
 */
export function extractTitleFromText(
  text: string,
  record: { linkText: string; issueNumber: number | null },
): string {
  const normalized = toHalfWidth(text);

  // 定例会・臨時会タイトルを優先抽出
  const sessionMatch = normalized.match(
    /(令和|平成)(元|\d+)年\s*第\d+回(定例会|臨時会)/,
  );
  if (sessionMatch) return sessionMatch[0].trim();

  // 議会だより号数をタイトルとして使用
  if (record.issueNumber) {
    return `議会だより寿都湾 No.${record.issueNumber}`;
  }

  return record.linkText || "寿都町議会だより";
}

/**
 * ● マーカーで始まる答弁者行から役職を抽出する。
 * 例: "● 町長" → "町長"
 */
function parseResponder(line: string): string | null {
  const match = line.match(/^●\s*(.+)/);
  if (!match) return null;
  return match[1]!.trim();
}

/**
 * ■ マーカーで始まる質問者行から質問者名を抽出する。
 * 例: "■ 質問" → null（次の行が質問者名）
 */
function isQuestionMarker(line: string): boolean {
  return /^■\s*(質問|再質問)/.test(line.trim());
}

/**
 * 「{氏名}　議員」形式から氏名を抽出する。
 */
function parseQuestioner(line: string): string | null {
  const match = line.match(/^(.+?)[\s　]+議員$/);
  if (!match) return null;
  return match[1]!.trim();
}

/**
 * PDF テキスト全体から発言リストをパースする。
 *
 * 議会だよりの一般質問セクションを対象に:
 * - ■ 質問 / ■ 再質問 → 議員の質問
 * - ● 町長 / ● 教育長 等 → 行政側の答弁
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split(/\n/);
  let i = 0;

  // 現在の質問者
  let currentQuestioner: string | null = null;
  let awaitingQuestioner = false;

  while (i < lines.length) {
    const line = lines[i]!.trim();
    i++;

    if (!line) continue;

    // ■ 質問 / ■ 再質問 マーカー
    if (isQuestionMarker(line)) {
      awaitingQuestioner = true;
      continue;
    }

    // 質問者名行（■ マーカーの次の行）
    if (awaitingQuestioner) {
      const questioner = parseQuestioner(line);
      if (questioner) {
        currentQuestioner = questioner;
        awaitingQuestioner = false;
        continue;
      }
      // 質問者名でなければ、この行は質問内容として処理
      awaitingQuestioner = false;
    }

    // ● 答弁者行
    const responder = parseResponder(line);
    if (responder) {
      // 答弁内容を収集（次の ■ または ● まで）
      const contentLines: string[] = [];
      while (i < lines.length) {
        const nextLine = lines[i]!.trim();
        if (!nextLine) {
          i++;
          continue;
        }
        if (/^[■●]/.test(nextLine)) break;
        contentLines.push(nextLine);
        i++;
      }

      const content = contentLines.join(" ").replace(/\s+/g, " ").trim();
      if (content && content.length >= 5) {
        const contentHash = createHash("sha256").update(content).digest("hex");
        const startOffset = offset;
        const endOffset = offset + content.length;

        const role = responder;
        statements.push({
          kind: classifyKind(role),
          speakerName: null,
          speakerRole: role,
          content,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      }
      continue;
    }

    // 質問内容行（■ マーカー直後で質問者名が見つかった後）
    if (currentQuestioner) {
      // 質問内容を収集（次の ■ または ● まで）
      const contentLines: string[] = [line];
      while (i < lines.length) {
        const nextLine = lines[i]!.trim();
        if (!nextLine) {
          i++;
          continue;
        }
        if (/^[■●]/.test(nextLine)) break;
        contentLines.push(nextLine);
        i++;
      }

      const content = contentLines.join(" ").replace(/\s+/g, " ").trim();
      if (content && content.length >= 5) {
        const contentHash = createHash("sha256").update(content).digest("hex");
        const startOffset = offset;
        const endOffset = offset + content.length;

        statements.push({
          kind: "question",
          speakerName: currentQuestioner,
          speakerRole: "議員",
          content,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      }
    }
  }

  return statements;
}

/**
 * PDF バイナリからテキストを抽出する。
 */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (e) {
    console.warn("[013927-suttsu] unpdf extractText failed", e);
    return null;
  }
}

/**
 * PDF レコードから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  record: SuttuPdfRecord,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const buffer = await fetchBinary(record.pdfUrl);
  if (!buffer) return null;

  const text = await extractTextFromPdf(buffer);
  if (!text) return null;

  const heldOn = extractDateFromText(text, record);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const title = extractTitleFromText(text, record);

  // PDF URL のファイル名から externalId を生成
  const urlPath = new URL(record.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = fileName ? `suttsu_${fileName}` : null;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: record.pdfUrl,
    externalId,
    statements,
  };
}
