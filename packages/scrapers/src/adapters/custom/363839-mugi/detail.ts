/**
 * 牟岐町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 牟岐町の PDF は「氏名＋役職 内容」形式で発言が記録される。
 * 例:
 *   木本議員 皆様、おはようございます。...
 *   喜田議長 枡富町長。
 *   枡富町長 皆さん、おはようございます。...
 *   今津教育長 お答えいたします。...
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";
import type { MugiPdfRecord } from "./list";

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
  "政策監",
  "管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "事務局長",
]);

/**
 * 「氏名＋役職」形式のヘッダーを解析する。
 *
 * 牟岐町の PDF 形式:
 *   木本議員      → role=議員, name=木本
 *   喜田議長      → role=議長, name=喜田
 *   枡富町長      → role=町長, name=枡富
 *   今津教育長    → role=教育長, name=今津
 *   総務課長      → role=課長, name=総務（姓のみ or 部署名+役職）
 */
export function parseSpeakerHeader(header: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const nameOrPrefix = header.slice(0, -suffix.length).trim();
      // 名前部分が空（役職のみ）の場合
      const speakerName = nameOrPrefix.length > 0 ? nameOrPrefix : null;
      return { speakerName, speakerRole: suffix };
    }
  }
  return { speakerName: null, speakerRole: null };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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
 * 牟岐町 PDF テキストを ParsedStatement 配列に変換する。
 *
 * 発言形式: 「氏名役職 発言内容 次の氏名役職 発言内容 ...」
 * 発言境界を示すパターン: \s{2,}氏名役職\s  または  。\s+氏名役職\s
 */
export function parseStatements(text: string): ParsedStatement[] {
  if (!text.trim()) return [];

  // 役職サフィックスの正規表現パターンを構築（長い方から）
  const rolePat = ROLE_SUFFIXES.map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

  // 発言者ヘッダーの検出パターン: \S+{役職} の形式
  // 先頭または空白の後に来る「非空白文字列+役職」を発言者ヘッダーとみなす
  const speakerPattern = new RegExp(
    `(?:^|(?<=[。」）\\s]\\s*))([^\\s　。、（）「」]{1,15}?(?:${rolePat}))(?=\\s)`,
    "g"
  );

  // 発言ブロックに分割
  const blocks: Array<{ header: string; start: number; end: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = speakerPattern.exec(text)) !== null) {
    const header = m[1]!;
    const { speakerRole } = parseSpeakerHeader(header);
    if (!speakerRole) continue;

    blocks.push({
      header,
      start: m.index + (m[0]!.length - m[1]!.length),
      end: m.index + m[0]!.length,
    });
  }

  if (blocks.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const nextBlock = blocks[i + 1];

    const contentStart = block.end;
    const contentEnd = nextBlock ? nextBlock.start : text.length;
    const rawContent = text.slice(contentStart, contentEnd).trim();

    if (!rawContent) continue;

    // ト書き（登壇・退席など）のみの場合はスキップ
    if (/^[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(rawContent)) continue;

    const { speakerName, speakerRole } = parseSpeakerHeader(block.header);
    const content = rawContent;

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
      `[363839-mugi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 * heldOn が null の場合は null を返す。
 */
export async function buildMeetingData(
  params: MugiPdfRecord,
  municipalityCode: string
): Promise<MeetingData | null> {
  // 開催日がない場合は処理しない
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF ファイル名（パスの末尾）を externalId に使う
  const pdfFileName = params.pdfUrl.split("/").pop()?.replace(".pdf", "") ?? "unknown";

  return {
    municipalityCode,
    title: `${params.title} ${params.pdfLabel}`.trim(),
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `mugi_${params.docId}_${pdfFileName}`,
    statements,
  };
}
