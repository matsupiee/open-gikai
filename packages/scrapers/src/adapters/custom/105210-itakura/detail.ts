/**
 * 板倉町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、〇 マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   〇小林武雄議長 ただいまから…
 *   〇小野田富康町長 皆さん、おはようございます。
 *   〇延山宗一議会運営委員長 おはようございます。
 *   〇玉水美由紀健康介護課長 それでは…
 *   〇８番 荒井英世議員 ８番、荒井です。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface ItakuraDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
  detailUrl: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会運営委員長",
  "予算決算常任委員長",
  "総務文教福祉常任委員長",
  "産業建設生活常任委員長",
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
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
  "管理者",
  "会計管理者",
  "町長",
  "議長",
  "議員",
  "委員",
] as const;

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
  "室長",
  "局長",
  "事務局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "管理者",
  "会計管理者",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 対応パターン:
 *   〇小林武雄議長 テキスト          → name=小林武雄, role=議長
 *   〇小野田富康町長 テキスト         → name=小野田富康, role=町長
 *   〇延山宗一議会運営委員長 テキスト  → name=延山宗一, role=議会運営委員長
 *   〇玉水美由紀健康介護課長 テキスト  → name=玉水美由紀, role=健康介護課長
 *   〇８番 荒井英世議員 テキスト      → name=荒井英世, role=議員
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●〇]\s*/, "");

  // 番号付き議員パターン: "８番 荒井英世議員 テキスト"
  const numberedMatch = stripped.match(
    /^[\d０-９]+番\s+([^\s　]+)議員[\s　]+([\s\S]*)/
  );
  if (numberedMatch) {
    const name = numberedMatch[1]!.replace(/[\s　]+/g, "").trim();
    const content = numberedMatch[2]!.trim();
    return { speakerName: name, speakerRole: "議員", content };
  }

  // 先頭の名前+役職部分を取得（スペースまで）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1]!;
  const content = headerMatch[2]!.trim();

  // 役職サフィックスにマッチする場合: "小林武雄議長" → name=小林武雄, role=議長
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  // 〇マーカーがある場合、役職が不明でも先頭を名前として扱う
  if (/^[○◯◎●〇]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
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
    speakerRole === "副委員長" ||
    speakerRole.endsWith("委員長")
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
 * 板倉町の PDF は 〇氏名役職 本文テキスト の形式で発言を記録している。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 〇 マーカーで分割（目次・不応招議員欄などの単純な見出しも含む）
  const blocks = text.split(/(?=[○◯◎●〇])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●〇]/.test(trimmed)) continue;

    // ト書き（登壇・退席等）をスキップ
    if (/^[○◯◎●〇]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]/.test(trimmed))
      continue;

    // 単純な見出し行（本文なし）をスキップ: 「〇開会の宣告」「〇町長挨拶」等
    // スペースなしで終わるか、改行のみで続く場合はスキップ
    const normalized = trimmed.replace(/\s+/g, " ").trim();

    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;

    // 内容が短すぎる（5文字未満）はスキップ
    if (content.length < 5) continue;

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
      `[105210-itakura] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: ItakuraDetailParams,
  municipalityCode: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // detailUrl から ID 部分を抽出して externalId を生成
  const idMatch = params.detailUrl.match(/d034010\/([^/]+)\.html/);
  const pageId = idMatch?.[1] ?? params.heldOn;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `itakura_${pageId}_${params.heldOn}`,
    statements,
  };
}
