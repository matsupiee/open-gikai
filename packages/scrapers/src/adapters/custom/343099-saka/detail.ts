/**
 * 坂町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（田中太郎君）　それでは、ただいまから会議を開きます。
 *   ○町長（山田花子君）　お答えいたします。
 *   ○３番（鈴木一郎君）　質問いたします。
 *   ○教育長（佐藤二郎君）　お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, parseWarekiYear, toHalfWidth } from "./shared";

export interface SakaDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: string;
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
  "委員",
  "議員",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
];

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
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（田中太郎君）　→ role=議長, name=田中太郎
 *   ○町長（山田花子君）　→ role=町長, name=山田花子
 *   ○３番（鈴木一郎君）　→ role=議員, name=鈴木一郎
 *   ○教育長（佐藤二郎君）→ role=教育長, name=佐藤二郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（鈴木一郎君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
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

  // ○ マーカーはあるがカッコパターンに合致しない場合
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
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF テキストから開催日を抽出する。
 * 例: "令和６年第１回坂町議会定例会会議録" の前後にある日付情報
 * フォールバックとして "令和○年○月○日" パターンを探す。
 */
export function extractHeldOn(text: string, _fallbackYear: number | null): string | null {
  // 「○月○日」パターン（全角・半角混在対応）
  const datePattern = toHalfWidth(text).match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  );
  if (datePattern) {
    const year = parseInt(datePattern[1]!, 10);
    const month = parseInt(datePattern[2]!, 10);
    const day = parseInt(datePattern[3]!, 10);
    if (year >= 1990 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // 和暦 + 月日パターン
  const wareki = toHalfWidth(text).match(
    /(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/,
  );
  if (wareki) {
    const era = wareki[1]!;
    const n = wareki[2] === "元" ? 1 : parseInt(wareki[2]!, 10);
    const year = era === "令和" ? 2018 + n : 1988 + n;
    const month = parseInt(wareki[3]!, 10);
    const day = parseInt(wareki[4]!, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
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

    // ト書き（登壇等）をスキップ
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
      `[343099-saka] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * URL からユニークな externalId を生成する。
 */
function buildExternalId(pdfUrl: string, _heldOn: string | null): string {
  // wp-content/uploads パスからファイル名を抽出
  const fileMatch = pdfUrl.match(/\/([^/]+\.pdf)(?:\?.*)?$/i);
  const fileName = fileMatch
    ? fileMatch[1]!.replace(/[^a-zA-Z0-9_\-]/g, "_")
    : "unknown";
  return `saka_${fileName}`;
}

/**
 * detailParams から MeetingData を組み立てる。
 * PDF をダウンロード・テキスト抽出し、発言を解析する。
 */
export async function buildMeetingData(
  params: SakaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // heldOn が未設定の場合は PDF テキストから抽出
  let heldOn = params.heldOn;
  if (!heldOn) {
    const fallbackYear = parseWarekiYear(toHalfWidth(params.title));
    heldOn = extractHeldOn(text, fallbackYear);
  }

  // heldOn が解析できない場合は null のまま返せないので null を返す
  if (!heldOn) return null;

  const externalId = buildExternalId(params.pdfUrl, heldOn);

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
