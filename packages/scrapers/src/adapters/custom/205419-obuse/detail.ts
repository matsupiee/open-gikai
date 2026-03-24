/**
 * 小布施町議会 -- detail フェーズ
 *
 * 会議詳細ページから PDF リンクを収集し、
 * 各 PDF をダウンロードしてテキストを抽出し、
 * ○ マーカーで発言を分割して ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（想定）:
 *   ○議長（○○○○君）　それでは、ただいまから会議を開きます。
 *   ○町長（○○○○君）　お答えいたします。
 *   ○○番（○○○○君）　質問いたします。
 *   ○総務課長（○○○○君）　お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  parseDetailPagePdfs,
  parsePdfFileName,
} from "./list";
import { detectMeetingType, fetchBinary, fetchPage } from "./shared";

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
  "事務局長",
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
 *   ○町長（山田一郎君）　→ role=町長, name=山田一郎
 *   ○３番（佐藤花子君）　→ role=議員, name=佐藤花子
 *   ○総務課長（高橋三郎君）→ role=課長, name=高橋三郎
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

    // 番号付き議員: ○３番（佐藤花子君）
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
 * 和暦日付ラベルから YYYY-MM-DD 形式に変換する。
 * e.g., "令和7年3月3日" → "2025-03-03"
 * 変換できない場合は null を返す。
 */
export function parseHeldOn(heldOnLabel: string): string | null {
  // 全角数字を半角に正規化
  const normalized = heldOnLabel.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const match = normalized.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const baseYear = era === "令和" ? 2018 : 1988;
  const year = baseYear + eraYear;

  const month = String(parseInt(match[3]!, 10)).padStart(2, "0");
  const day = String(parseInt(match[4]!, 10)).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
      `[205419-obuse] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export interface ObusePdfDetailParams {
  detailUrl: string;
  sessionTitle: string;
  pdfUrl: string;
  heldOnLabel: string | null;
}

/**
 * 単一 PDF から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  params: ObusePdfDetailParams,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // heldOnLabel が渡されていればそれを使い、なければ PDF ファイル名から抽出
  let heldOn: string | null = null;
  if (params.heldOnLabel) {
    heldOn = parseHeldOn(params.heldOnLabel);
  }
  if (!heldOn) {
    // PDF ファイル名から日付を抽出
    const pdfMeta = parsePdfFileName(params.pdfUrl);
    if (pdfMeta) {
      heldOn = parseHeldOn(pdfMeta.heldOnLabel);
    }
  }
  if (!heldOn) return null;

  // PDF URL を externalId に使う
  const urlPath = new URL(params.pdfUrl).pathname;
  const externalId = `obuse_${urlPath}`;

  return {
    municipalityId,
    title: params.sessionTitle,
    meetingType: detectMeetingType(params.sessionTitle),
    heldOn,
    sourceUrl: params.detailUrl,
    externalId,
    statements,
  };
}

/**
 * 会議詳細ページから PDF リンクを収集し、PDF ごとの detailParams を返す。
 * list フェーズで呼ばれる。
 */
export async function fetchPdfParamsFromDetailPage(
  detailUrl: string,
  sessionTitle: string,
): Promise<ObusePdfDetailParams[]> {
  const html = await fetchPage(detailUrl);
  if (!html) return [];

  const pdfUrls = parseDetailPagePdfs(html);
  if (pdfUrls.length === 0) return [];

  return pdfUrls.map((pdfUrl) => {
    const pdfMeta = parsePdfFileName(pdfUrl);
    return {
      detailUrl,
      sessionTitle,
      pdfUrl,
      heldOnLabel: pdfMeta?.heldOnLabel ?? null,
    };
  });
}

