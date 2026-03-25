/**
 * 府中町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（力山 彰君）
 *   ○副議長（森本 将文君）
 *   ○１０番（西山 優君）
 *   ○町長（寺尾 光司君）
 *   ○教育長（新田 憲章君）
 *   ○福祉保健部長（中本 孝弘君）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { FuchuMeeting } from "./list";
import { detectMeetingType, extractExternalIdKey, fetchBinary, parseDateText } from "./shared";

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
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
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
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（力山 彰君）　→ role=議長, name=力山彰
 *   ○町長（寺尾 光司君）→ role=町長, name=寺尾光司
 *   ○１０番（西山 優君）→ role=議員, name=西山優
 *   ○福祉保健部長（中本 孝弘君）→ role=部長, name=中本孝弘
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

    // 番号付き議員: ○１０番（西山 優君）
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
 * 府中町の PDF テキストは文字間にスペースが入っている（例: "○ 議 長 （ 力 山 彰 君 ）"）。
 * この関数でスペースを除去して正規化する。
 *
 * ただし句読点・括弧の後のスペースは文の区切りを示すため、
 * 全てのスペースを除去するのではなく、文字間の単一スペースを除去する。
 */
export function normalizeSpacedText(text: string): string {
  // 全角・半角スペースが1文字ずつ挟まっているパターンを除去
  // "○ 議 長" → "○議長", "力 山 彰 君" → "力山彰君"
  // ただし複数連続するスペースは区切りとして残す
  let prev = "";
  let curr = text;
  while (prev !== curr) {
    prev = curr;
    curr = curr.replace(/([^\s]) ([^\s])/g, "$1$2");
  }
  return curr;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 府中町 PDF はテキストが全てスペース区切りのため正規化する
  const normalized = normalizeSpacedText(text);
  const blocks = normalized.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
      continue;

    // 区切り線パターン「○～～～」をスキップ
    if (/^[○◯◎●]\s*[～~]+/.test(trimmed)) continue;

    const clean = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(clean);
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
 * PDF テキストは文字間にスペースが入っているため、まず正規化してからパースする。
 * "１ ． 開 会 年 月 日 令 和 ７ 年 １ ２ 月 １ ２ 日 （ 金 ）" → "2025-12-12"
 */
export function extractHeldOn(text: string): string | null {
  const normalized = normalizeSpacedText(text.slice(0, 2000));

  // 「開会年月日」パターン
  const match = normalized.match(
    /開会年月日[\s　]*((?:令和|平成)(?:元|[\d０-９]+)年[\d０-９]+月[\d０-９]+日)/
  );
  if (match) {
    return parseDateText(match[1]!);
  }
  // フォールバック: テキスト先頭付近から日付を検索
  const fallback = normalized.match(/((?:令和|平成)(?:元|[\d０-９]+)年[\d０-９]+月[\d０-９]+日)/);
  if (fallback) {
    return parseDateText(fallback[1]!);
  }
  return null;
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
      `[343021-fuchu-town] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: FuchuMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから開催日を抽出（list フェーズで取得できなかった場合のフォールバック）
  const heldOn = meeting.heldOn || extractHeldOn(text);
  if (!heldOn) return null;

  const idKey = extractExternalIdKey(new URL(meeting.pdfUrl).pathname);
  const externalId = idKey ? `fuchu-town_${idKey}` : null;

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
