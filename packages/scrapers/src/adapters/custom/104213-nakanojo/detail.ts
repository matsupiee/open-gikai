/**
 * 中之条町議会（群馬県） — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（ドキュメントより）:
 *   〇議長（安原賢一）みなさん、おはようございます。
 *   〇町長（外丸茂樹）それでは、日程に従いまして...
 *   〇３番（山本修）詳しいご説明いただきまして...
 *
 * 注意: 中之条町の PDF は Identity-H エンコーディング（CID フォント）を使用しており、
 * unpdf (pdfjs-dist) では文字抽出できないため pdftotext コマンドを使用する。
 * 発言マーカーは主に 〇（U+3007）を使用、一部 ○（U+25CB）も混在する。
 */

import { createHash } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  detectMeetingType,
  fetchBinary,
  normalizeFullWidth,
} from "./shared";

const execFileAsync = promisify(execFile);

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
 * 中之条町のパターン（pdftotext 出力）:
 *   "〇議長（安原賢一）みなさん、おはようございます。"
 *   → role="議長", name="安原賢一"
 *
 *   "〇３番（山本修）詳しいご説明いただきまして..."
 *   → role="議員", name="山本修"
 *
 *   "〇町長（外丸茂樹）それでは..."
 *   → role="町長", name="外丸茂樹"
 *
 * 発言マーカーは 〇（U+3007）または ○（U+25CB）。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const normalized = normalizeFullWidth(text);

  // 〇 or ○ + {役職・番号}（{氏名}） パターン（全角括弧）
  // U+3007（〇）と U+25CB（○）の両方に対応
  const fullWidthMatch = normalized.match(
    /^[\u3007\u25CB\u25CE\u25CF◯●]\s*(.+?)（(.+?)）\s*([\s\S]*)/,
  );
  if (fullWidthMatch) {
    const roleOrNumber = fullWidthMatch[1]!.replace(/\s+/g, "").trim();
    const rawName = fullWidthMatch[2]!.replace(/\s+/g, "").trim();
    const content = fullWidthMatch[3]!.trim();

    // 番号付き議員: "3番" または全角 "３番"
    if (/^\d+番$/.test(roleOrNumber)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方を先に）
    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrNumber === suffix || roleOrNumber.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: roleOrNumber || null, content };
  }

  // 半角括弧のフォールバック
  const halfWidthMatch = normalized.match(
    /^[\u3007\u25CB\u25CE\u25CF◯●]\s*(.+?)\((.+?)\)\s*([\s\S]*)/,
  );
  if (halfWidthMatch) {
    const roleOrNumber = halfWidthMatch[1]!.replace(/\s+/g, "").trim();
    const rawName = halfWidthMatch[2]!.replace(/\s+/g, "").trim();
    const content = halfWidthMatch[3]!.trim();

    if (/^\d+番$/.test(roleOrNumber)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrNumber === suffix || roleOrNumber.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: roleOrNumber || null, content };
  }

  return { speakerName: null, speakerRole: null, content: normalized.trim() };
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
  // 複合役職（例: "総務課長"）
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * 中之条町の発言者を識別する正規表現。
 *
 * パターン: 〇/○{役職または番号}（{氏名}）
 * 全角・半角括弧に対応。
 * U+3007（〇）と U+25CB（○）の両方に対応。
 */
const SPEAKER_RE =
  /[\u3007\u25CB\u25CE\u25CF◯●]\s*(?:副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|事務局長|局長|副部長|部長|副課長|課長|室長|係長|参事|主幹|主査|補佐|議員|委員|[\d０-９]+番)[（(][^（(）)]{1,20}[）)]/g;

/**
 * pdftotext で抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 発言者は 〇/○{役職}（{氏名}） パターンで識別する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  const normalized = normalizeFullWidth(rawText);

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

    const block = normalized.slice(current.index, nextIndex).trim();
    if (!block) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content) continue;

    // ト書き（登壇・着席等）のみは無視
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
 *
 * 中之条町の PDF は Identity-H エンコーディング（CID フォント）を使用しており、
 * unpdf (pdfjs-dist) では文字抽出できないため pdftotext コマンドを使用する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  const tmpPath = join(tmpdir(), `nakanojo_${Date.now()}.pdf`);
  try {
    await writeFile(tmpPath, Buffer.from(buffer));
    const { stdout } = await execFileAsync("pdftotext", ["-layout", tmpPath, "-"]);
    return stdout;
  } catch (err) {
    console.warn(
      `[104213-nakanojo] PDF テキスト抽出失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

export interface NakanojoDetailParams {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  meetingType: "plenary" | "extraordinary";
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  params: NakanojoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  // heldOn が解析できない場合は null を返す（フォールバック値禁止）
  if (!params.heldOn) return null;

  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: attachment ID から生成
  const attachmentId = params.pdfUrl.match(/\/attachment\/(\d+)\.pdf$/)?.[1] ?? null;
  const externalId = attachmentId ? `nakanojo_${attachmentId}` : null;

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
