/**
 * 御杖村議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * PDF 冒頭から開催日・会議名を抽出する:
 *   "平成29年5月26日　御杖村議会臨時会会議録"
 *   "令和7年12月定例会会議録"
 *
 * 発言パターン:
 *   ○議長（田中○○）　...
 *   ○村長（山本○○）　...
 *   ○○番（氏名）　...
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { MitsueMeeting } from "./list";
import {
  detectMeetingType,
  fetchBinary,
  normalizeDigits,
  parseDateText,
} from "./shared";

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
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中一郎君）　ただいまから開会します。
 *   ○村長（山本花子君）　お答えいたします。
 *   ○３番（佐藤次郎君）　質問いたします。
 *   ○総務課長（鈴木三郎君）　ご説明いたします。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（山田太郎君）
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
 */
export function parseStatements(text: string): ParsedStatement[] {
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
 * PDF テキストから開催日を抽出する。
 * "令和６年１２月 ２日開会" のような冒頭テキストから取得。
 * 御杖村の PDF は全角数字を使用するため normalizeDigits で変換してからパースする。
 * パース失敗時は null を返す。
 */
export function extractHeldOn(text: string): string | null {
  // PDF 冒頭 500 文字から日付を探す
  const head = normalizeDigits(text.slice(0, 500));
  return parseDateText(head);
}

/**
 * PDF テキストから会議タイトルを抽出する。
 * ファイル名に命名規則の統一性がないため、PDF 本文から取得する。
 * 全角数字を含む可能性があるため normalizeDigits で変換してから抽出する。
 */
export function extractTitle(text: string, fallbackTitle: string): string {
  // 会議タイトルのパターンを探す:
  // - "令和5年第1回3月定例会会議録"（タイトルに会議録が含まれる）
  // - "令和6年第4回（12月）定例会 御杖村議会会議録"（スペースを挟んで会議録が続く）
  const head = normalizeDigits(text.slice(0, 500));
  const titleMatch = head.match(
    /((?:令和|平成|昭和)(?:元|\d+)年[^\n\r]{0,60}会議録)/
  );
  if (titleMatch) return titleMatch[1]!.replace(/[\s　]+/g, " ").trim();
  return fallbackTitle;
}

/** PDF URL からテキストを取得する。 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[293865-mitsue] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: MitsueMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日は PDF 本文から抽出
  const heldOn = extractHeldOn(text);
  if (!heldOn) {
    console.warn(`[293865-mitsue] 開催日の抽出失敗: ${meeting.pdfUrl}`);
    return null;
  }

  const title = extractTitle(text, meeting.title);

  // ファイル名をベースにした外部 ID
  const fileMatch = meeting.pdfUrl.match(/\/([^/]+)\.pdf$/);
  const externalId = fileMatch ? `mitsue_${fileMatch[1]}` : null;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
