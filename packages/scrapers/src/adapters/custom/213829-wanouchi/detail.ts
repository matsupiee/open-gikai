/**
 * 輪之内町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（上野賢二君）
 *   ○副町長（荒川 浩君）
 *   ○町長（朝倉和仁君）
 *   ○教育長（長屋英人君）
 *   ○９番（田中政治君）
 *   ○５番（浅野 進君）
 *   ○企画財政商工課長（菱田靖雄君）
 *   ○文教厚生常任委員長（林 日出雄君）
 *   ○人口減少対策特別委員長（大橋慶裕君）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { WanouchiMeeting } from "./list";
import { detectMeetingType, fetchBinary } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ — CRITICAL）
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
  "参事",
  "主幹",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "参事",
  "主幹",
]);

/**
 * 全角数字を半角数字に変換する。
 */
function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（上野賢二君） → role=議長, name=上野賢二
 *   ○町長（朝倉和仁君） → role=町長, name=朝倉和仁
 *   ○９番（田中政治君） → role=議員, name=田中政治
 *   ○企画財政商工課長（菱田靖雄君） → role=課長, name=菱田靖雄
 *   ○文教厚生常任委員長（林 日出雄君） → role=委員長, name=林日出雄
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)君[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○９番（田中政治君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
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

  // ○ マーカーはあるがカッコパターンに合致しない場合
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
 * PDF テキストから開催日を抽出する。
 * e.g., "令和 ７ 年 ３ 月 ３ 日" → "2025-03-03"
 *
 * PDF 抽出テキストはスペース区切りになることがあるため対応。
 * 「開会」または「閉会」の前の日付を優先して取得する。
 */
export function parseDateFromPdf(text: string): string | null {
  const normalized = normalizeDigits(text);

  // 開会日を優先して抽出
  const openMatch = normalized.match(
    /(令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日\s*開会/
  );
  const target = openMatch ?? normalized.match(
    /(令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/
  );

  if (!target) return null;

  const [, era, eraYearStr, monthStr, dayStr] = target;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF テキストから会議タイトルを抽出する。
 * e.g., "第１回定例輪之内町議会会議録" → "令和7年第1回定例輪之内町議会"
 */
export function parseTitleFromPdf(text: string): string | null {
  const normalized = normalizeDigits(text);

  // 年号を抽出
  const eraMatch = normalized.match(/(令和|平成)\s*(元|\d+)\s*年/);
  if (!eraMatch) return null;
  const era = eraMatch[1]!;
  const eraYearStr = eraMatch[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);

  // 会議名を抽出
  const sessionMatch = normalized.match(
    /第\s*(\d+)\s*回\s*(定例|臨時)\s*輪之内町議会/
  );
  if (!sessionMatch) return null;

  const num = sessionMatch[1]!;
  const kind = sessionMatch[2]!;

  return `${era}${eraYear}年第${num}回${kind}輪之内町議会`;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 動作・声の表記をスキップ（例: （「異議なし」の声あり））
    if (/^[○◯◎●]\s*[（(].+?[）)]$/.test(trimmed)) continue;

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
      `[213829-wanouchi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: WanouchiMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストからタイトルと開催日を抽出
  const title = parseTitleFromPdf(text);
  if (!title) return null;

  const heldOn = parseDateFromPdf(text);
  if (!heldOn) return null;

  const externalId = `wanouchi_${meeting.fileCode}`;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
