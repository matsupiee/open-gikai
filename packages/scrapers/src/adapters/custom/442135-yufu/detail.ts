/**
 * 由布市議会 — detail フェーズ
 *
 * list フェーズで収集済みの detailParams から PDF をダウンロードし、
 * テキスト抽出・発言パースを行って MeetingData を生成する。
 *
 * 由布市の会議録 PDF は全文（発言者・発言内容）を含む。
 * 発言者は「○」マーカーで始まる行で識別される。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

/**
 * 役職サフィックスリスト（長い方を先に配置して誤マッチを防ぐ）
 */
export const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副市長",
  "副部長",
  "副課長",
  "教育長",
  "事務局長",
  "議長",
  "市長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主事",
  "補佐",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主事",
  "補佐",
  "副部長",
  "副課長",
  "事務局長",
]);

export interface YufuDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎君）　ただいまから…   → role=議長, name=山田太郎
 *   ○１番（田中一郎君）　質問します。     → role=議員, name=田中一郎
 *   ○市長（鈴木次郎君）　お答えします。   → role=市長, name=鈴木次郎
 *   ○山田総務部長　ご報告いたします。     → role=部長, name=山田総務
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: {number}番（{name}君|議員|様）content
  const numberBracketMatch = stripped.match(
    /^[\d０-９]+番[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (numberBracketMatch) {
    const name = numberBracketMatch[1]!.trim().replace(/\s+/g, "");
    const content = numberBracketMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // パターン2: {role}（{name}君|議員|様）content
  const roleBracketMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|議員|様)[）)]\s*([\s\S]*)/,
  );
  if (roleBracketMatch) {
    const rolePart = roleBracketMatch[1]!.trim();
    const name = roleBracketMatch[2]!.trim().replace(/\s+/g, "");
    const content = roleBracketMatch[3]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    return { speakerName: name, speakerRole: rolePart || null, content };
  }

  // パターン3: {name}{role} content (e.g., 山田総務課長 ...)
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

    // ○マーカーがある場合、役職が不明でも先頭を名前として扱う
    if (/^[○◯◎●]/.test(text)) {
      return { speakerName: header, speakerRole: null, content };
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類する */
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
  // サフィックスによる判定（例: "総務課長" → answer）
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

    // ト書き（登壇・退席・退場・着席）をスキップ
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
      `[442135-yufu] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn が解析できない場合は null を返す。
 * statements が空の場合も null を返す。
 */
export async function fetchMeetingData(
  params: YufuDetailParams,
  municipalityId: string,
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `yufu_${encodeURIComponent(params.pdfUrl)}`,
    statements,
  };
}
