/**
 * 黒石市議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言を ParsedStatement 配列に変換する。
 *
 * 発言フォーマット（◯マーカー）:
 *   ◯田中議長　ただいまから会議を開きます。
 *   ◯佐藤議員　質問いたします。
 *   ◯山田市長　お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary } from "./shared";

export interface KuroishiDetailParams {
  title: string;
  heldOn: string | null;
  meetingType: "plenary" | "extraordinary" | "committee";
  pdfUrl: string;
}

// 役職サフィックスリスト（長い方を先に配置して誤マッチを防ぐ）
export const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副市長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "事務長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "議長",
  "市長",
  "会長",
  "管理者",
  "議員",
  "委員",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "事務局長",
  "局長",
  "事務長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "会長",
  "管理者",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 * フォーマット: "◯渡辺議長 ただいまから本日の会議を開きます。"
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");

  // 先頭の名前+役職部分を取得（スペースまで）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = stripped.slice(headerMatch[0].length).trim();

  // 役職サフィックスにマッチする場合: "渡辺議長" → name=渡辺, role=議長
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  // ◯マーカーがある場合、役職が不明でも先頭を名前として扱う
  if (/^[○◯〇◎●]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
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
 * 発言マーカーが議事日程等の構造行か判定する。
 * 出席議員、欠席議員等の一覧行はスキップ。
 */
function isStructuralLine(text: string): boolean {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");
  return /^(議事日程|本日の会議|出席議員|欠席議員|出席者|欠席者|地方自治法)/.test(
    stripped
  );
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ◯/○/〇 マーカーで発言ブロックを分割
  const blocks = text.split(/(?=[○◯〇◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇◎●]/.test(trimmed)) continue;

    // 議事日程等の構造行はスキップ
    if (isStructuralLine(trimmed)) continue;

    // ト書き（登壇・退席等）をスキップ
    if (
      /^[○◯〇◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]/.test(trimmed)
    )
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
      `[022047-kuroishi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "files/R07_1T_01.pdf" → "R07_1T_01"
 */
function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/**
 * detailParams から MeetingData を組み立てる。
 * heldOn が null の場合は null を返す。
 */
export async function fetchMeetingData(
  params: KuroishiDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  let pathname: string;
  try {
    pathname = new URL(params.pdfUrl).pathname;
  } catch {
    pathname = params.pdfUrl;
  }
  const idKey = extractExternalIdKey(pathname);
  const externalId = idKey ? `kuroishi_${idKey}` : null;

  return {
    municipalityId,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
