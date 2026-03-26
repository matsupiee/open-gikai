/**
 * 東峰村議会（福岡県） — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者ラベルで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 東峰村の会議録 PDF フォーマット:
 *   テキストはページ区切りなしの一続き文字列として抽出される。
 *   発言者ラベルは役職名（漢字間にスペースあり）として出現する。
 *
 *   例:
 *     「開 会 議 長 おはようございます。...」
 *     「議 長 ただ今、...」
 *     「村 長 皆さん、おはようございます。...」
 *     「５ 番 私も先ほどの...」
 *     「総務企画課長 １７ページをお願いします。...」
 *
 *   - 役職名に全角スペース（　）や半角スペース( )が含まれることがある
 *   - 番号議員は「[数字] 番」パターン（全角・半角数字対応）
 *   - 課長・室長等は連続した漢字として出現（スペースなし）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { TohoMeeting } from "./list";
import { fetchBinary } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "政策監",
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
  "会計管理者",
]);

// remark として分類する役職
const REMARK_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
  "議会事務局長",
  "事務局長",
]);

/**
 * 全角数字を半角に変換する
 */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 東峰村 PDF 特有の「スペース入り役職名」を正規化する。
 *
 * 「議 長」→「議長」, 「村 長」→「村長」, 「副 村 長」→「副村長」
 * 「教 育 長」→「教育長」
 */
function normalizeRole(raw: string): string {
  return raw.replace(/[\s　]+/g, "");
}

/**
 * 役職名から発言種別を判定する。
 */
export function classifyKind(
  role: string | null,
): "remark" | "question" | "answer" {
  if (!role) return "remark";
  if (REMARK_ROLES.has(role)) return "remark";
  if (ANSWER_ROLES.has(role)) return "answer";
  // "XX課長", "XX室長" 等のサフィックスマッチ
  for (const ar of ANSWER_ROLES) {
    if (role.endsWith(ar)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストから発言者ラベルの出現位置を検出するための正規表現を構築する。
 *
 * パターン:
 *   1. 番号議員:   「[全半角数字][ 　]*番」
 *   2. 既知役職:   スペース区切りの漢字列（例: 「議 長」「村 長」「副 村 長」）
 *   3. 連続役職:   「XX課長」「XX室長」「XX局長」等（スペースなし）
 *
 * 注意: PDF 抽出テキストはスペースが不規則に挿入されるため、
 *       パターンは柔軟に対応できるよう設計する。
 */
const SPEAKER_PATTERN = new RegExp(
  [
    // 番号議員: 全角・半角数字 + スペース? + 番
    String.raw`(?<![^\s])([０-９\d]+)[ 　]*番(?=[ 　])`,
    // スペース入り既知役職（議 長 / 副 議 長 / 村 長 / 副 村 長 / 教 育 長 / 副 教 育 長）
    String.raw`(?<![^\s])(議[ 　]*長|副[ 　]*議[ 　]*長|村[ 　]*長|副[ 　]*村[ 　]*長|教[ 　]*育[ 　]*長|副[ 　]*教[ 　]*育[ 　]*長)(?=[ 　])`,
    // 委員長系
    String.raw`(?<![^\s])(副[ 　]*委[ 　]*員[ 　]*長|委[ 　]*員[ 　]*長)(?=[ 　])`,
    // 事務局長系
    String.raw`(?<![^\s])(議会[ 　]*事務局長|事務局長)(?=[ 　])`,
    // XX課長 / XX室長 / XX局長 / XX係長 等（連続する漢字のあとに役職サフィックス）
    String.raw`(?<![^\s])(\S{2,10}?(?:課長|副課長|室長|局長|係長|部長|副部長|参事|主幹|主査|補佐|政策監|会計管理者))(?=[ 　])`,
  ].join("|"),
  "g",
);

interface SpeakerSegment {
  rawLabel: string;
  role: string;
  isNumberMember: boolean;
  memberNumber: number | null;
  startIndex: number;
  contentStartIndex: number;
}

/**
 * PDF テキストから発言者セグメント一覧を抽出する。
 */
function detectSpeakers(text: string): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  const regex = new RegExp(SPEAKER_PATTERN.source, "g");

  for (const match of text.matchAll(regex)) {
    const rawLabel = match[0];
    const startIndex = match.index!;
    const contentStartIndex = startIndex + rawLabel.length;

    // Determine which capture group matched
    let role: string;
    let isNumberMember = false;
    let memberNumber: number | null = null;

    // Group 1: 番号議員
    if (match[1] !== undefined) {
      const num = toHalfWidth(match[1]);
      memberNumber = parseInt(num, 10);
      isNumberMember = true;
      role = "議員";
    } else {
      // Groups 2-5: role-based speakers
      const rawRole =
        match[2] ?? match[3] ?? match[4] ?? match[5] ?? rawLabel;
      role = normalizeRole(rawRole.trim());
    }

    segments.push({
      rawLabel,
      role,
      isNumberMember,
      memberNumber,
      startIndex,
      contentStartIndex,
    });
  }

  return segments;
}

/**
 * PDF テキストから ParsedStatement 配列を生成する。
 *
 * 発言者セグメントを基点として、次の発言者ラベルまでのテキストを発言内容とする。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const speakers = detectSpeakers(text);
  if (speakers.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < speakers.length; i++) {
    const speaker = speakers[i]!;
    const nextSpeaker = speakers[i + 1];

    // Content = from contentStartIndex to next speaker's startIndex (or end)
    const contentEnd = nextSpeaker ? nextSpeaker.startIndex : text.length;
    const rawContent = text.slice(speaker.contentStartIndex, contentEnd);
    const content = rawContent.replace(/\s+/g, " ").trim();

    // Skip very short/empty content (e.g., transition markers)
    if (!content || content.length < 3) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speaker.role),
      speakerName: null, // 東峰村 PDF には発言者の個人名が含まれない
      speakerRole: speaker.role,
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
      `[404489-toho] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF ハッシュファイル名から externalId を生成する。
 * 例: "0d27345e4595e4ea81d4598673001794.pdf" → "toho_0d27345e4595e4ea81d4598673001794"
 */
function extractExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `toho_${match[1]}`;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: TohoMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const externalId = extractExternalId(meeting.pdfUrl);

  return {
    municipalityCode,
    title: `${meeting.title} ${meeting.heldOn}`,
    meetingType: meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pageUrl,
    externalId,
    statements,
  };
}
