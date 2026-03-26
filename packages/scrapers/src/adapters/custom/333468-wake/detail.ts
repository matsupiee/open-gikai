/**
 * 和気町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、〇 マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（山本太郎君）　ただいまから会議を開きます。
 *   ○町長（田中一郎君）　お答えいたします。
 *   ○３番（佐藤花子君）　質問いたします。
 *   ○総務課長（鈴木次郎君）　お答えいたします。
 *
 * マーカー: ○ (U+25CB CIRCLE) または 〇 (U+3007 IDEOGRAPHIC NUMBER ZERO)
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary, toHalfWidth } from "./shared";

export interface WakeDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  headingYear: number;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
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
  "管理者",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "所長",
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
  "管理者",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "係長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 〇/○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山本太郎君）　→ role=議長, name=山本太郎
 *   ○町長（田中一郎君）　→ role=町長, name=田中一郎
 *   ○３番（佐藤花子君）　→ role=議員, name=佐藤花子
 *   ○総務課長（鈴木次郎君）　→ role=課長, name=鈴木次郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 〇 (U+3007) または ○ (U+25CB) マーカーを除去
  const stripped = text.replace(/^[〇○]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（佐藤花子君）
    if (/^[\d０-９]+番$/.test(toHalfWidth(rolePart))) {
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

  // マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(/^([^\s\u3000]{1,30})[\s\u3000]+([\s\S]*)/);
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
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長" ||
    speakerRole === "議会運営委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * 〇 (U+3007) または ○ (U+25CB) マーカーで分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 両方のマーカーで分割
  const blocks = text.split(/(?=[〇○])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[〇○]/.test(trimmed)) continue;

    // 議事日程など見出し項目をスキップ
    if (/^[〇○]議事日程/.test(trimmed)) continue;
    if (/^[〇○]出席議員/.test(trimmed)) continue;
    if (/^[〇○]欠席議員/.test(trimmed)) continue;
    if (/^[〇○]出席説明員/.test(trimmed)) continue;
    if (/^[〇○]出席事務局/.test(trimmed)) continue;
    if (/^[〇○]会議録署名議員/.test(trimmed)) continue;

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
      `[333468-wake] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 * PDF をダウンロード・テキスト抽出し、発言を分割する。
 */
export async function buildMeetingData(
  params: WakeDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出
  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  // ファイル ID を externalId に使う
  const fileIdMatch = params.pdfUrl.match(/\/(\d+)\.pdf$/);
  const fileId = fileIdMatch?.[1] ?? params.pdfUrl;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `wake_${fileId}`,
    statements,
  };
}
