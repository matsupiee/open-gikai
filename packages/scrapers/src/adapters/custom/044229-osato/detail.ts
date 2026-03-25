/**
 * 大郷町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（○ マーカーなし）:
 *   議長（石垣正博君）　皆さん、おはようございます。
 *   保健福祉課長（小野純一君）　皆様、おはようございます。
 *   ７番（鈴木恵子君）　質問します。
 *
 * ト書き:
 *   ［「なし」と呼ぶ者あり］
 *   〔賛成者起立〕
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OsatoMeeting } from "./list";
import { detectMeetingType, fetchBinary, toHankaku } from "./shared";

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
  "室長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "監査委員",
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
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "監査委員",
]);

/**
 * 発言行から発言者情報を抽出する。
 *
 * 対応パターン（○マーカーなし）:
 *   議長（石垣正博君）　ただいまから → role=議長, name=石垣正博
 *   町長（佐藤一郎君）　お答えします → role=町長, name=佐藤一郎
 *   ７番（鈴木恵子君）　質問します → role=議員, name=鈴木恵子
 *   保健福祉課長（小野純一君）　説明します → role=課長, name=小野純一
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // パターン: role（name + 君|様|議員）content
  const match = text.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ７番（鈴木恵子君）
    const normalizedRole = toHankaku(rolePart);
    if (/^\d+番$/.test(normalizedRole)) {
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

  return { speakerName: null, speakerRole: null, content: text.trim() };
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
 * 大郷町の PDF は ○ マーカーを使わず、テキストが改行なしの連続文字列として抽出される。
 * 発言者パターン「役職（氏名君）」のマッチ位置を順番に検出し、
 * 次の発言者パターンまでの区間を内容として抽出する。
 *
 * ト書き（[...] や 〔...〕）はブロック内から除去する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // 発言者パターン（役職（氏名君）または N番（氏名君））を全件検出する
  // ※ 全角番号（７番など）も対象
  // 役職パターン: 日本語文字列で終わる役職
  const speakerPattern =
    /([^\s　（(「」【】\[〔\]〕]{1,20})[（(]([^\s）)]{1,20})(?:君|様|議員)[）)]/g;

  // 有効な発言者マッチを収集する
  const matches: Array<{ index: number; role: string; name: string }> = [];

  for (const m of text.matchAll(speakerPattern)) {
    const rolePart = m[1]!.trim();
    const namePart = m[2]!.trim();

    // 役職かどうかを確認する
    const normalizedRole = toHankaku(rolePart);
    const isNumberedMember = /^\d+番$/.test(normalizedRole);
    const isKnownRole = ROLE_SUFFIXES.some(
      (suffix) => rolePart === suffix || rolePart.endsWith(suffix)
    );

    if (isNumberedMember || isKnownRole) {
      matches.push({ index: m.index!, role: rolePart, name: namePart });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const matchStart = matches[i]!.index;
    const nextStart = i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    const block = text.slice(matchStart, nextStart).trim();

    if (!block) continue;

    const normalized = block.replace(/\s+/g, " ").trim();
    const { speakerName, speakerRole, content: rawContent } = parseSpeaker(normalized);
    if (!rawContent) continue;

    // ト書き（［...］ または 〔...〕）を除去する
    const content = rawContent
      .replace(/[［〔][^］〕]*[］〕]/g, "")
      .replace(/\s+/g, " ")
      .trim();

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
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function extractHeldOnFromPdfText(text: string): string | null {
  const normalized = toHankaku(text);

  // パターン: 令和X年X月X日 または 平成X年X月X日
  const match = normalized.match(
    /(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2]! === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      `[044229-osato] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: OsatoMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF テキストから開催日を抽出（list フェーズで取得できなかった場合のフォールバック）
  const heldOn = meeting.heldOn ?? extractHeldOnFromPdfText(text);
  if (!heldOn) return null;

  // PDF URL からファイル名部分を取得して外部 ID とする
  const urlPath = new URL(meeting.pdfUrl).pathname;
  const fileName = urlPath.split("/").pop() ?? urlPath;
  const externalId = `osato_${fileName.replace(".pdf", "")}`;

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
