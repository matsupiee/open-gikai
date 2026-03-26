/**
 * 玉村町議会（群馬県） — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（玉村町の場合）:
 *   ○議長（田中一郎君） ただいまから...
 *   ○町長（山田太郎君） お答えいたします。
 *   ○３番（鈴木花子君） 質問します。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  detectMeetingType,
  fetchBinary,
  normalizeFullWidth,
  deSpacePdfText,
} from "./shared";

export interface TamamuraDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

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
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
] as const;

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
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 玉村町のパターン（「○」マーカー付き）:
 *   "○議長（田中一郎君） ただいまから..."
 *   → role="議長", name="田中一郎"
 *
 *   "○３番（鈴木花子君） 質問します。"
 *   → role="議員", name="鈴木花子"
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 先頭の ○ マーカーを除去
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = normalizeFullWidth(match[1]!).replace(/\s+/g, "").trim();
    const rawName = normalizeFullWidth(match[2]!).replace(/\s+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: "3番（佐藤太郎君）"
    if (/^[\d]+番$/.test(rolePart)) {
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

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
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
  ) {
    return "remark";
  }
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 玉村町の発言者を識別するパターン。
 *
 * 「○」マーカーで始まり、役職または番号議員 + （氏名 + 君|様）の形式。
 */
const SPEAKER_RE =
  /[○◯◎●]\s*(?:副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|事務局長|局長|副部長|部長|副課長|課長|室長|係長|参事|主幹|主査|補佐|議員|委員|[\d０-９]+番|[^\s（(]{1,20})[（(][^（(）)]{1,20}(?:君|様)[）)]/g;

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  // 全角文字を正規化し、PDF 抽出の文字間スペースを除去する
  const normalized = deSpacePdfText(normalizeFullWidth(rawText));

  // 発言者パターンの出現位置を全て収集する
  const speakerMatches: { index: number; match: string }[] = [];
  for (const m of normalized.matchAll(new RegExp(SPEAKER_RE.source, "g"))) {
    if (m.index !== undefined) {
      speakerMatches.push({ index: m.index, match: m[0] });
    }
  }

  if (speakerMatches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < speakerMatches.length; i++) {
    const current = speakerMatches[i]!;
    const nextIndex =
      i + 1 < speakerMatches.length
        ? speakerMatches[i + 1]!.index
        : normalized.length;

    // 発言者ヘッダー + 発言内容のブロック
    const block = normalized.slice(current.index, nextIndex).trim();
    if (!block) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content) continue;

    // ト書き（登壇等）のみは無視
    if (/^(?:（[^）]*(?:登壇|退席|退場|着席)[^）]*）)?$/.test(content.trim()))
      continue;

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
      `[104647-tamamura] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  params: TamamuraDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  // heldOn が解析できない場合は null を返す
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: PDF ファイル名から生成
  const filename =
    new URL(params.pdfUrl).pathname
      .split("/")
      .pop()
      ?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `tamamura_${filename}` : null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
