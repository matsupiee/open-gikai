/**
 * 青ヶ島村議会 — detail フェーズ
 *
 * 広報誌 PDF をダウンロードしてテキストを抽出し、議決一覧セクションをパースする。
 *
 * 青ヶ島村は全文会議録をオンライン公開していないため、
 * 議案番号・議決結果・議案名のみを構造化データとして収集する。
 * 各議案を1つの remark ステートメントとして扱う。
 *
 * PDF テキスト抽出後の実際のフォーマット（スペースや全角数字が混在）:
 *   令和 6 年青ヶ島村議会第１回定例会議決一覧
 *   ３月７日
 *   議案第 1 号 原案可決 青ヶ島村長等の給料等に関する条例の一部を改正する条例について
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AogashimaPdf } from "./list";
import { detectMeetingType, eraToWesternYear, fetchBinary } from "./shared";

/** 議決一覧から抽出された1セッション */
export interface AogashimaSession {
  /** セッションタイトル (e.g., "令和6年青ヶ島村議会第1回定例会") */
  title: string;
  /** 開催日 YYYY-MM-DD（議決一覧内の日付から） */
  heldOn: string;
  /** 議案リスト */
  bills: AogashimaBill[];
}

/** 議案1件 */
export interface AogashimaBill {
  /** 議案番号 (e.g., 1) */
  number: number;
  /** 議決結果 (e.g., "原案可決", "同意") */
  result: string;
  /** 議案名 */
  title: string;
}

/** 全角数字を半角に変換する */
function normalizeNumbers(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * PDF テキストを正規化する。
 * - 全角数字を半角に変換
 * - 連続する空白を1つに統一（改行は維持）
 */
function normalizeText(text: string): string {
  return normalizeNumbers(text).replace(/[ \t\u3000]+/g, " ");
}

/**
 * PDF テキストから議決一覧セッションを抽出する（テスト可能な純粋関数）。
 *
 * 「青ヶ島村議会」を含むセクションのみ対象（教育委員会を除外）。
 */
export function parseSessions(rawText: string): AogashimaSession[] {
  const text = normalizeText(rawText);
  const sessions: AogashimaSession[] = [];

  // セッションヘッダー検出
  // 実際の PDF テキスト: "令和 6 年青ヶ島村議会第1回定例会議決一覧"
  const sessionPattern =
    /((?:令和|平成) ?(元|\d+) ?年)青ヶ島村議会第 ?(\d+) ?回 ?(定例会|臨時会)議決一覧/g;

  for (const headerMatch of text.matchAll(sessionPattern)) {
    const eraText = headerMatch[1]!;
    const era = eraText.startsWith("令和") ? "令和" : "平成";
    const eraYear = headerMatch[2] === "元" ? 1 : parseInt(headerMatch[2]!, 10);
    const westernYear = eraToWesternYear(era, eraYear);
    const sessionNum = headerMatch[3]!;
    const sessionType = headerMatch[4]!;
    const normalizedEra = `${era}${eraYear}年`;
    const title = `${normalizedEra}青ヶ島村議会第${sessionNum}回${sessionType}`;

    // セクション開始位置から次のセクション or 文末まで取得
    const startIdx = headerMatch.index! + headerMatch[0].length;
    const nextSessionMatch = text
      .slice(startIdx)
      .match(/(?:令和|平成) ?\d+ ?年度? ?(?:青ヶ島村議会|青ヶ島村教育委員会)/);
    const endIdx = nextSessionMatch
      ? startIdx + nextSessionMatch.index!
      : text.length;
    const sectionText = text.slice(startIdx, endIdx);

    // 開催日を抽出（セクション内の最初の日付）
    const dateMatch = sectionText.match(/(\d{1,2}) ?月 ?(\d{1,2}) ?日/);
    if (!dateMatch) continue; // 日付が解析できない場合はスキップ
    const month = parseInt(dateMatch[1]!, 10);
    const day = parseInt(dateMatch[2]!, 10);
    const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // 議案を抽出
    const bills = parseBills(sectionText);

    if (bills.length > 0) {
      sessions.push({ title, heldOn, bills });
    }
  }

  return sessions;
}

/**
 * セクションテキストから議案行を抽出する。
 * 入力テキストは normalizeText 済みを想定。
 */
export function parseBills(sectionText: string): AogashimaBill[] {
  const normalized = normalizeText(sectionText);
  const bills: AogashimaBill[] = [];

  // 議案パターン: "議案第 1 号 原案可決 青ヶ島村長等の..."
  // PDF にはタイプミス（"議第第"）があるケースも存在するため、"議案第" or "議第第" を許容
  const billPattern =
    /議(?:案|第)第 ?(\d+) ?号 ?(原案可決|同意|否決|撤回|原案否決|継続審査|可決) +([\s\S]+?)(?=議(?:案|第)第 ?\d+ ?号|$)/g;

  for (const match of normalized.matchAll(billPattern)) {
    const number = parseInt(match[1]!, 10);
    const result = match[2]!;
    const title = match[3]!
      .replace(/\s+/g, " ")
      .trim();

    if (title) {
      bills.push({ number, result, title });
    }
  }

  return bills;
}

/**
 * 議案を ParsedStatement に変換する。
 * 各議案は content に「議案第N号 [議決結果] 議案名」を格納し、kind は "remark" とする。
 */
export function billsToStatements(bills: AogashimaBill[]): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const bill of bills) {
    const content = `議案第${bill.number}号 ${bill.result} ${bill.title}`;
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
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
      `[134023-aogashima] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、議決一覧をパースして MeetingData 配列を返す。
 * 1つの PDF に複数セッション（複数日程分）が含まれる場合がある。
 */
export async function fetchMeetingDataFromPdf(
  pdf: AogashimaPdf,
  municipalityId: string
): Promise<MeetingData[]> {
  const text = await fetchPdfText(pdf.pdfUrl);
  if (!text) return [];

  const sessions = parseSessions(text);
  const results: MeetingData[] = [];

  for (const session of sessions) {
    const statements = billsToStatements(session.bills);
    if (statements.length === 0) continue;

    results.push({
      municipalityId,
      title: `${session.title}議決一覧`,
      meetingType: detectMeetingType(session.title),
      heldOn: session.heldOn,
      sourceUrl: pdf.pdfUrl,
      externalId: `aogashima_${pdf.filename.replace(".pdf", "")}_${session.title}`,
      statements,
    });
  }

  return results;
}
