/**
 * 佐川町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF テキスト）:
 *   議 長（ 松 浦 隆 起 君 ） お は よ う ご ざ い ま す 。
 *   ５ 番（ 橋 元 陽 一 君 ） 一 般 質 問 を さ せ て い た だ き ま す 。
 *   町 長（ 戸 梶 真 弓 君 ） お 答 え い た し ま す 。
 *   総務課長（ 山 脇 浩 二 君 ） ご 説 明 い た し ま す 。
 *
 * 特徴:
 * - 文字が1文字ずつ半角スペースで区切られている
 * - 「議 長（ 氏 名 君 ）」形式（半角スペース区切り）
 * - 番号議員は「N 番（ 氏 名 君 ）」形式
 * - 役職付きは「役職名（ 氏 名 君 ）」形式（役職名自体はスペースなし）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { SakawaMeeting } from "./list";
import { buildMeetingTitle } from "./list";
import { fetchBinary, normalizeDigits, eraToWesternYear } from "./shared";

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

// 役職サフィックス（長いものを先に並べて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副市長",
  "副村長",
  "町長",
  "市長",
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
 * 佐川町議会 PDF の発言行から話者情報を抽出する。
 *
 * 発言フォーマット:
 *   議 長（ 松 浦 隆 起 君 ） お は よ う ご ざ い ま す 。
 *   ５ 番（ 橋 元 陽 一 君 ） 一 般 質 問 ...
 *   総務課長（ 山 脇 浩 二 君 ） ご 説 明 ...
 */
export function parseSpeaker(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 全角スペースと半角スペースを統一して処理（佐川町は1文字ずつスペース区切り）
  const normalized = line.replace(/　/g, " ").trim();

  // カッコ形式: 役職（氏名 君）発言内容
  // 例: "議 長（ 松 浦 隆 起 君 ） お は よ う ..."
  // 佐川町の PDF は「君 ）」のように君の後にスペースが入るため \s* で対応
  const parenMatch = normalized.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)\s*[）)]\s*([\s\S]*)/
  );
  if (parenMatch) {
    // 役職部分のスペースを除去（"議 長" → "議長"）
    const rolePart = parenMatch[1]!.replace(/\s/g, "").trim();
    // 氏名中のスペースを除去して正規化（"松 浦 隆 起" → "松浦隆起"）
    const rawName = parenMatch[2]!.replace(/\s/g, "").trim();
    // 内容部分のスペースを除去して自然な文章に
    const rawContent = parenMatch[3]!.trim();
    // 内容が1文字ずつスペース区切りの場合はスペースを除去
    const content = normalizeSpacedText(rawContent);

    // 番号議員パターン: "8番" or "１番" → 議員
    const digitNorm = normalizeDigits(rolePart);
    if (/^\d+番$/.test(digitNorm)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  return { speakerName: null, speakerRole: null, content: normalized };
}

/**
 * 1文字ずつスペースで区切られたテキストを通常の文章に正規化する。
 *
 * 佐川町の PDF は文字間に半角スペースが入るが、それを除去しすぎると
 * 単語の区切りが消えてしまうため、以下のヒューリスティックを使う:
 * - ひらがな・カタカナ・漢字・記号が連続する場合はスペースを除去
 * - 数字や英字の前後のスペースは保持
 * - 文末の句読点（。、）前後のスペースは除去
 */
function normalizeSpacedText(text: string): string {
  // まず全角スペースを半角に変換
  let normalized = text.replace(/　/g, " ");

  // 日本語文字（ひらがな・カタカナ・漢字・句読点・括弧等）の間のスペースを除去
  // これを繰り返すことで全ての日本語文字間スペースを除去
  for (let i = 0; i < 5; i++) {
    normalized = normalized.replace(
      /([\u3000-\u9fff\uff00-\uffef。、！？「」『』（）・]) ([\u3000-\u9fff\uff00-\uffef。、！？「」『』（）・])/g,
      "$1$2"
    );
  }

  return normalized.trim();
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
 * 発言行かどうかを判定する。
 *
 * 佐川町の発言行パターン:
 *   「役職（ 氏名 君 ）」または「N 番（ 氏名 君 ）」の形式
 */
function isSpeakerLine(line: string): boolean {
  const normalized = line.replace(/　/g, " ").trim();
  // 「（...君）」または「（...様）」を含む行
  // 佐川町の PDF は「君 ）」のように君の後にスペースが入るため \s* で対応
  return /[（(].+?(?:君|様|議員)\s*[）)]/.test(normalized);
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * 佐川町の PDF には「令和６年３月１日」のような形式で日付が含まれる。
 * ただしテキストは1文字ずつスペースで区切られているため、
 * スペースを除去してからパースする。
 *
 * 解析できない場合は null を返す。
 */
export function parseMeetingDateFromText(text: string): string | null {
  // 全角数字を半角に変換し、スペースを除去してからパース
  const normalized = normalizeDigits(text).replace(/[ \t]/g, "");

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
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 佐川町の発言行は「役職（ 氏名 君 ）発言内容」形式で、
 * 文字が1文字ずつスペースで区切られている。
 * 複数行にまたがる発言内容も結合して処理する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 全角数字を半角に変換して処理しやすくする
  const normalized = normalizeDigits(text);

  // 行分割して発言ブロックを検出
  const lines = normalized.split(/\n/);
  const blocks: string[] = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isSpeakerLine(trimmed)) {
      if (current) {
        blocks.push(current.trim());
      }
      current = trimmed;
    } else {
      if (current) {
        current += " " + trimmed;
      }
      // current が空の場合（発言者なし）はスキップ
    }
  }
  if (current) {
    blocks.push(current.trim());
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content || content.length < 3) continue;

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
      `[394025-sakawa] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * SakawaMeeting から externalId を生成する。
 * e.g., pageId=2673, fileId=16512 → "sakawa_2673_16512"
 */
function buildExternalId(meeting: SakawaMeeting): string {
  return `sakawa_${meeting.pageId}_${meeting.fileId}`;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: SakawaMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日は PDF テキストから取得
  const heldOn = parseMeetingDateFromText(text);
  if (!heldOn) return null;

  const title =
    buildMeetingTitle(meeting.meetingName, meeting.linkText) || "佐川町議会 会議録";

  const externalId = buildExternalId(meeting);

  // 会議種別の判定
  const meetingType = title.includes("臨時") ? "extraordinary" : "plenary";

  return {
    municipalityCode,
    title,
    meetingType,
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
