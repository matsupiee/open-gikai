/**
 * 馬路村議会 — detail フェーズ
 *
 * 馬路村議会は会議録（発言録）のオンライン公開を行っていない。
 * 取得可能な情報は PDF へのリンクとリンクテキスト（会議名・日付等）のみ。
 *
 * そのため、PDF リンクのメタ情報（タイトル・日付）から MeetingData を生成する。
 * statements は PDF の説明文を単一の remark として格納する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { UmajiPdfEntry } from "./list";
import { detectMeetingType, parseJapaneseDate, parseYearFromTitle } from "./shared";

/**
 * PDF エントリのラベルから開催日（YYYY-MM-DD）を抽出する。
 *
 * 優先順位:
 * 1. ラベルから日付を抽出（例: 「第1回臨時会（令和7年1月20日）」）
 * 2. 投稿タイトルから日付を抽出
 */
export function extractHeldOn(entry: UmajiPdfEntry): string | null {
  return parseJapaneseDate(entry.label) ?? parseJapaneseDate(entry.postTitle);
}

/**
 * PDF エントリから会議タイトルを生成する。
 *
 * ラベルが「議決の状況」「一般質問の状況」等の PDF 分類名の場合は
 * 投稿タイトルをベースにし、ラベルが会議名を含む場合はラベルを使用する。
 */
export function buildMeetingTitle(entry: UmajiPdfEntry): string {
  const label = entry.label.trim();

  // ラベルが会議名パターン（定例会・臨時会を含む）の場合はラベルを使用
  if (/定例会|臨時会/.test(label)) {
    return label;
  }

  // それ以外は投稿タイトルをベースにラベルを付加
  if (label && label !== entry.postTitle) {
    return `${entry.postTitle} ${label}`.replace(/\s+/g, " ").trim();
  }

  return entry.postTitle;
}

/**
 * ラベルから会議タイプを判定する。
 * ラベルまたは投稿タイトルを参照する。
 */
export function detectMeetingTypeFromEntry(entry: UmajiPdfEntry): string {
  if (/臨時/.test(entry.label) || /臨時/.test(entry.postTitle)) {
    return "extraordinary";
  }
  return detectMeetingType(entry.label) ?? detectMeetingType(entry.postTitle);
}

/**
 * PDF エントリから外部 ID を生成する。
 * PDF URL のパス部分からハッシュを生成する。
 */
export function buildExternalId(entry: UmajiPdfEntry): string {
  const pathMatch = entry.pdfUrl.match(/\/wp-content\/uploads\/(.+)\.pdf$/i);
  if (pathMatch) {
    return `umaji_${pathMatch[1]!.replace(/\//g, "_")}`;
  }
  // フォールバック: URL ハッシュ
  const hash = createHash("sha256").update(entry.pdfUrl).digest("hex").slice(0, 16);
  return `umaji_${hash}`;
}

/**
 * PDF エントリのラベルから ParsedStatement を生成する。
 *
 * 馬路村は会議録テキストが公開されていないため、
 * PDF のラベルを単一の remark statement として格納する。
 */
export function buildStatements(entry: UmajiPdfEntry): ParsedStatement[] {
  const content = entry.label || entry.postTitle;
  if (!content) return [];

  const contentHash = createHash("sha256").update(content).digest("hex");
  return [
    {
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content,
      contentHash,
      startOffset: 0,
      endOffset: content.length,
    },
  ];
}

/**
 * PDF エントリから MeetingData を組み立てる。
 *
 * 会議録テキストは取得不可のため、PDF メタ情報のみから生成する。
 * 開催日が取得できない場合は null を返す。
 */
export function buildMeetingData(
  entry: UmajiPdfEntry,
  municipalityCode: string,
  targetYear: number
): MeetingData | null {
  const heldOn = extractHeldOn(entry);
  if (!heldOn) return null;

  // 対象年のフィルタリング
  const entryYear = parseYearFromTitle(entry.label) ?? parseYearFromTitle(entry.postTitle);
  if (entryYear !== null && entryYear !== targetYear) return null;

  const statements = buildStatements(entry);
  if (statements.length === 0) return null;

  const title = buildMeetingTitle(entry);
  const meetingType = detectMeetingTypeFromEntry(entry);
  const externalId = buildExternalId(entry);

  return {
    municipalityCode,
    title,
    meetingType,
    heldOn,
    sourceUrl: entry.postUrl,
    externalId,
    statements,
  };
}
