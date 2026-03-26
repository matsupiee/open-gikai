/**
 * 七宗町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * PDF テキストの特徴:
 * - スペース区切りで文字が分散: 議 長 （ 松 山 成 美 君 ）
 * - normalizeSpaces で正規化後: 議長（松山成美君）
 * - テキストは改行なしの連続テキストが多い
 * - 発言者は ○ マーカーなし、役職（氏名君）パターン
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HichisoMeeting } from "./list";
import { detectMeetingType, fetchBinary, normalizeSpaces } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
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
  "参事",
  "主幹",
  "係長",
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
  "事務局長",
  "局長",
  "参事",
  "主幹",
  "係長",
]);

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン（正規化済みテキスト）:
 *   議長（松山成美君）　→ role=議長, name=松山成美
 *   町長（堀部勝広君）　→ role=町長, name=堀部勝広
 *   ３番（加納竜也君）　→ role=議員, name=加納竜也
 *   教育課長（加納雅也君）→ role=課長, name=加納雅也
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const trimmed = text.trim();

  // パターン: role（name + 君|様）content
  const match = trimmed.match(
    /^(.+?)[（(](.+?)(?:君|様)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ３番（加納竜也君）
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

  return { speakerName: null, speakerRole: null, content: trimmed };
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
 * 全角数字を半角に変換する。
 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * PDF テキストから開催日を抽出する。
 * 冒頭部に「令和X年X月X日」の形式で記載（全角数字にも対応）。
 */
export function parseDateFromText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|[\d０-９]+)年([\d０-９]+)月([\d０-９]+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear =
    match[2] === "元" ? 1 : Number(toHalfWidth(match[2]!));
  const month = Number(toHalfWidth(match[3]!));
  const day = Number(toHalfWidth(match[4]!));

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 発言者パターンの正規表現。
 * 正規化済みテキスト内で発言者ヘッダーを検出する。
 *
 * マッチ例:
 *   議長（松山成美君）
 *   町長（堀部勝広君）
 *   ３番（加納竜也君）
 *   教育課長（加納雅也君）
 */
const SPEAKER_PATTERN =
  /(?:[\d０-９]+番|[^\s（()）、。]{0,10}(?:副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|事務局長|局長|副部長|部長|副課長|課長|参事|主幹|係長))[（(][^）)]+?(?:君|様)[）)]/g;

/**
 * 正規化済みテキストを発言者パターンで分割し ParsedStatement 配列に変換する。
 *
 * 七宗町の PDF テキストは連続テキストで、○ マーカーがなく
 * 役職（氏名君）パターンで発言者を識別する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  // スペース区切りの日本語を正規化
  const text = normalizeSpaces(rawText);

  // 発言者パターンの位置を全て検出
  const matches: { index: number; header: string }[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SPEAKER_PATTERN.source, "g");
  while ((m = re.exec(text)) !== null) {
    matches.push({ index: m.index, header: m[0] });
  }

  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const headerEnd = current.index + current.header.length;
    const nextStart = i + 1 < matches.length ? matches[i + 1]!.index : text.length;

    const contentText = text.slice(headerEnd, nextStart).trim();
    if (!contentText) continue;

    // ト書き（登壇等）のみの発言はスキップ
    if (/^[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(contentText)) continue;
    // 登壇表記で始まるものは登壇部分を除去
    const cleanContent = contentText.replace(/^[（(].+?(?:登壇|退席)[）)]\s*/, "").trim();
    if (!cleanContent) continue;

    const fullBlock = current.header + " " + cleanContent;
    const { speakerName, speakerRole, content } = parseSpeaker(fullBlock);
    if (!content || !speakerName) continue;

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
      `[215040-hichiso] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HichisoMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから正確な開催日を取得
  const normalizedText = normalizeSpaces(text);
  const heldOn = parseDateFromText(normalizedText) ?? meeting.heldOn;

  // externalId: ファイル名ベース
  const decodedUrl = decodeURIComponent(meeting.pdfUrl);
  const filenameMatch = decodedUrl.match(/([^/]+)\.pdf$/i);
  const externalId = filenameMatch
    ? `hichiso_${filenameMatch[1]}`
    : null;

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
