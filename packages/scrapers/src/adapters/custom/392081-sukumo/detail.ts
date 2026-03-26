/**
 * 宿毛市議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF テキスト）:
 *   ○議長（氏名）
 *   ○副議長（氏名）
 *   ○N番（氏名）
 *   ○市長（氏名）
 *   ○副市長（氏名）
 *   ○教育長（氏名）
 *   ○○○部長（氏名）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { SukumoMeeting } from "./list";
import { eraToWesternYear, detectMeetingType, fetchBinary } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "町長",
  "副町長",
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "教育次長",
]);

// 進行役の役職
const REMARK_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
]);

// 役職サフィックス（長い順に並べて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "副町長",
  "副村長",
  "市長",
  "町長",
  "村長",
  "副教育長",
  "教育長",
  "教育次長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "課長補佐",
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

/**
 * 役職文字列からロールサフィックスをマッチさせる。
 * 長いパターンを先にチェックして誤マッチを防ぐ。
 */
function matchRole(rolePart: string): string | null {
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

/**
 * ○ マーカー付きの発言テキストから話者情報を抽出する。
 *
 * 宿毛市の PDF テキストはカッコ形式:
 *   ○ 議長（山田太郎君） 発言内容
 *   ○ 市長（鈴木一郎君） 発言内容
 *   ○ 1番（田中花子君） 発言内容
 *   ○ 総務課長（佐藤次郎君） 発言内容
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: カッコ形式 — role（name + 君|様|議員）content
  const parenMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (parenMatch) {
    const rolePart = parenMatch[1]!.trim();
    const rawName = parenMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = parenMatch[3]!.trim();

    // 番号議員パターン: "1番" → 議員
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  // パターン2: スペース区切り形式
  const tokens = stripped.split(/\s+/);
  if (tokens.length >= 3) {
    for (let i = 1; i <= Math.min(3, tokens.length - 2); i++) {
      const rolePart = tokens[i]!;
      const role = matchRole(rolePart);
      if (role) {
        const name = tokens.slice(0, i).join("");
        const content = tokens.slice(i + 1).join(" ").trim();
        return { speakerName: name, speakerRole: role, content };
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
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * ○ マーカーで発言ごとに分割し、出席表の出欠マーカー（短いテキスト）は除外する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 出席表の出欠マーカー除外: ○ の後が短いテキスト
    const afterMarker = trimmed.replace(/^[○◯◎●]\s*/, "").trim();
    if (afterMarker.length < 5) continue;

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

/** 全角数字を半角数字に変換する */
function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}

/**
 * PDF テキストの冒頭から開催日（YYYY-MM-DD）を抽出する。
 *
 * 会議録の冒頭パターン:
 *   令和X年X月X日
 * 全角数字にも対応する。
 */
export function parseMeetingDateFromText(text: string): string | null {
  const normalized = normalizeDigits(text.replace(/[\s　]+/g, " ")).trim();

  // 「令和X年X月X日」または「平成X年X月X日」パターン
  const eraMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (eraMatch) {
    const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
    const westernYear = eraToWesternYear(era!, eraYearStr!);
    if (!westernYear) return null;
    const month = parseInt(monthStr!, 10);
    const day = parseInt(dayStr!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * PDF URL から externalId 用のキーを抽出する。
 * e.g., "/fs/7/0/0/5/0/_/_____6__1____.pdf" → "fs_7_0_0_5_0______6__1____"
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  // /fs/ 以降のパスを取得してキー化
  const match = pdfUrl.match(/\/fs\/(.+)\.pdf$/i);
  if (!match) return null;
  return match[1]!.replace(/[/\\]/g, "_");
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
      `[392081-sukumo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 開催日を決定する。
 * PDF テキストから取得を試み、失敗した場合は meeting のメタ情報から推定する。
 */
function resolveHeldOn(
  pdfText: string,
  meeting: SukumoMeeting
): string | null {
  // まず PDF テキストから取得を試みる
  const fromText = parseMeetingDateFromText(pdfText);
  if (fromText) return fromText;

  // フォールバック: meeting の year と month から推定（月の初日）
  if (meeting.month) {
    const y = meeting.year;
    const m = meeting.month;
    return `${y}-${String(m).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: SukumoMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = resolveHeldOn(text, meeting);
  if (!heldOn) return null;

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `sukumo_${idKey}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.section),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
