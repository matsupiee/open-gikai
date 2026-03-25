/**
 * 南幌町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 南幌町 PDF の発言フォーマット:
 *
 * 一般質問 PDF（質問者氏名+役職 → 答弁者氏名+役職 形式）:
 *   家塚議員{content}       ← 氏名+議員
 *   大崎町長{content}       ← 氏名+役職
 *   家塚議員（再質問）{content}
 *   大崎町長（再答弁）{content}
 *
 * 会議録 PDF（役職のみ形式）:
 *   議長{content}           ← 役職のみ
 *   佐藤議員{content}       ← 短縮氏名+議員
 *   町長{content}           ← 役職のみ
 *   副町長{content}
 *
 * 発言者の識別パターン:
 *   - 境界文字（。」）●空白 等）の直後に出現する
 *   - `{0-6 漢字}{役職サフィックス}（任意の括弧）` の形
 *   - 名前プレフィックスは漢字のみ（ひらがな/カタカナは含まない）
 *
 * 前置き（出席議員リスト等）はスキップするため、
 * 実際の会議開始位置（日時表示・①印・議長発言）から解析を開始する。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, normalizeFullWidth, deSpacePdfText, detectMeetingType } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
  "参事",
  "主幹",
  "主査",
  "補佐",
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
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 役職から発言種別を分類する。
 */
export function classifyKind(
  speakerRole: string | null,
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
 * 発言者ラベル（`{name}{role}` または `{role}`）を解析して name/role を返す。
 */
export function parseSpeakerLabel(label: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const normalized = normalizeFullWidth(label).replace(/\s+/g, "");

  // 役職サフィックスを探す（長い方を優先）
  for (const suffix of ROLE_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      const namepart = normalized.slice(0, normalized.length - suffix.length);
      return {
        speakerName: namepart.length > 0 ? namepart : null,
        speakerRole: suffix,
      };
    }
  }

  return { speakerName: null, speakerRole: null };
}

const ROLE_PATTERN_STR =
  "(?:副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|事務局長|局長|副部長|部長|副課長|課長|室長|係長|参事|主幹|主査|補佐|議員|委員)";

/**
 * 南幌町の発言者識別パターン。
 *
 * 発言者ラベルは境界文字（。」）●空白 等）の直後に出現する。
 * 名前プレフィックスは漢字のみ（0-4 文字）+ 役職サフィックス。
 * 4文字以内に制限することで「会議録署名議員」などの偽陽性を防ぐ。
 *
 * キャプチャグループ:
 *   [1]: フルラベル（名前+役職+括弧補足）
 */
const SPEAKER_RE = new RegExp(
  `(?:^|[。」）●\\s①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])((?:[\\u4E00-\\u9FFF]{0,4})${ROLE_PATTERN_STR})(?:[（(][^）)]{1,20}[）)])?`,
  "g",
);

/**
 * PDF テキストにおける実際の会議開始位置を返す。
 *
 * 会議録 PDF: 最初の `●日程` または `議長` + 発言の出現位置
 * 一般質問 PDF: `①` の出現位置
 *
 * 前置き（出席議員リスト、日程表等）より後の位置を返す。
 * 見つからない場合は 0 を返す。
 */
export function findContentStart(text: string): number {
  // 一般質問: ①② などの質問番号が実際の内容の始まり
  const circledMatch = text.match(/[①-⑳]/);
  if (circledMatch?.index !== undefined) {
    return circledMatch.index;
  }

  // 会議録: ●日程 マーカーが実際の会議内容の始まり
  const nichiMatch = text.match(/●日程/);
  if (nichiMatch?.index !== undefined) {
    return nichiMatch.index;
  }

  // 会議録: `議長` に続いて発言が始まるパターン（議長おはようございます等）
  const kaigichoMatch = text.match(/議長[おただ]/);
  if (kaigichoMatch?.index !== undefined) {
    return kaigichoMatch.index;
  }

  return 0;
}

/**
 * PDF から抽出した正規化テキストを ParsedStatement 配列に変換する。
 *
 * 前置き（出席者リスト等）をスキップし、実際の発言部分のみを解析する。
 * 呼び出し形式（`。副町長。副町長{content}`）では発言内容が空のブロックを除外する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  // まず全角文字を正規化し、その後 PDF 抽出の文字間スペースを除去する
  const fullText = deSpacePdfText(normalizeFullWidth(rawText));

  // 前置き（出席者リスト等）をスキップ
  const startIdx = findContentStart(fullText);
  const normalized = fullText.slice(startIdx);

  // 発言者パターンの出現位置を全て収集する
  const speakerMatches: {
    index: number;
    label: string;
    name: string | null;
    role: string | null;
    labelLen: number;
  }[] = [];

  const reSpeaker = new RegExp(SPEAKER_RE.source, "g");
  for (const m of normalized.matchAll(reSpeaker)) {
    if (m.index === undefined) continue;
    const boundaryLen = m[0]!.length - m[1]!.length; // 境界文字の長さ
    const labelStart = m.index + boundaryLen;
    const fullLabel = m[1]!;
    const { speakerName, speakerRole } = parseSpeakerLabel(fullLabel);
    if (!speakerRole) continue;

    speakerMatches.push({
      index: labelStart,
      label: fullLabel,
      name: speakerName,
      role: speakerRole,
      labelLen: fullLabel.length,
    });
  }

  if (speakerMatches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < speakerMatches.length; i++) {
    const current = speakerMatches[i]!;
    const contentStart = current.index + current.labelLen;
    const contentEnd =
      i + 1 < speakerMatches.length
        ? speakerMatches[i + 1]!.index
        : normalized.length;

    const content = normalized.slice(contentStart, contentEnd).trim();

    // 空の発言ブロック（呼び出し形式の最初の役職ラベルなど）はスキップ
    if (!content) continue;

    // ト書き（登壇等）のみは無視
    if (/^(?:（[^）]*(?:登壇|退席|退場|着席)[^）]*）)?$/.test(content.trim()))
      continue;

    // 短すぎる発言（記号や1文字のみ）はスキップ
    if (content.replace(/[。、「」（）\s]/g, "").length < 3) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(current.role),
      speakerName: current.name,
      speakerRole: current.role,
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
      `[014231-nanporo] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: {
    pdfUrl: string;
    title: string;
    heldOn: string | null;
    pdfType: "会議録" | "一般質問";
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  // heldOn が解析できない場合は null を返す（フォールバック値禁止）
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: PDF ファイル名から生成
  const filename =
    new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `nanporo_${filename}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
