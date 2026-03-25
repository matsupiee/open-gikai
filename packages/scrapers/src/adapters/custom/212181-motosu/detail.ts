/**
 * 本巣市議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言マーカー記号で発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（大西德三郎君）　発言内容テキスト
 *   ○１０番（今枝和子君）　発言内容テキスト
 *   ○市長（藤原 勉君）　発言内容テキスト
 *
 * マーカー記号:
 *   ○ (U+25CB) = 発言者マーカー
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary } from "./shared";

export interface MotosuDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  heldOn: string | null;
  sessionTitle: string;
}

// 発言マーカー
const SPEECH_MARKERS = "○";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "議会だより編集特別委員会委員長",
  "議会運営委員会委員長",
  "議会運営委員長",
  "特別委員会委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "教育次長",
  "事務局長",
  "局長",
  "管理者",
  "副部長",
  "部長",
  "副課長",
  "課長補佐",
  "室長",
  "課長",
  "係長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

/**
 * マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（氏名君）　→ role=議長, name=氏名
 *   ○市長（氏名君）　→ role=市長, name=氏名
 *   ○１０番（氏名君）→ role=議員, name=氏名
 *   ○総務部長（氏名君）→ role=部長, name=氏名
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○]\s*/, "");

  // パターン1: role（name + 君|様|さん）content
  const matchWithSuffix = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|さん)[）)]\s*([\s\S]*)/,
  );
  // パターン2: role（name）content（敬称なし）
  const matchWithoutSuffix = stripped.match(
    /^(.+?)[（(]([^）)]+)[）)]\s*([\s\S]*)/,
  );

  const match = matchWithSuffix ?? matchWithoutSuffix;
  if (match) {
    const rolePart = match[1]!.trim();
    let rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    if (!matchWithSuffix) {
      rawName = rawName.replace(/(?:君|様|さん)$/, "");
    }

    // 番号付き議員: ○１０番（氏名）
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

  // マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(
    /^([^\s\u3000]{1,30})[\s\u3000]+([\s\S]*)/,
  );
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

/**
 * 発言者ロールから発言種別を判定する。
 */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長" ||
    speakerRole === "議会運営委員長" ||
    speakerRole === "議会運営委員会委員長" ||
    speakerRole === "特別委員会委員長" ||
    speakerRole === "議会だより編集特別委員会委員長"
  )
    return "remark";

  if (
    speakerRole === "市長" ||
    speakerRole === "副市長" ||
    speakerRole === "町長" ||
    speakerRole === "副町長" ||
    speakerRole === "教育長" ||
    speakerRole === "副教育長" ||
    speakerRole === "教育次長" ||
    speakerRole === "事務局長" ||
    speakerRole === "局長" ||
    speakerRole === "管理者" ||
    speakerRole === "部長" ||
    speakerRole === "副部長" ||
    speakerRole === "課長" ||
    speakerRole === "副課長" ||
    speakerRole === "課長補佐" ||
    speakerRole === "室長" ||
    speakerRole === "係長" ||
    speakerRole === "所長" ||
    speakerRole === "参事" ||
    speakerRole === "主幹" ||
    speakerRole === "主査" ||
    speakerRole === "補佐"
  )
    return "answer";

  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * ○ マーカーで分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const marker = trimmed.charAt(0);
    if (!SPEECH_MARKERS.includes(marker)) continue;

    // メタ情報をスキップ
    if (/^[○]議事日程/.test(trimmed)) continue;
    if (/^[○]出席議員/.test(trimmed)) continue;
    if (/^[○]欠席議員/.test(trimmed)) continue;
    if (/^[○]出席説明/.test(trimmed)) continue;
    if (/^[○]出席事務/.test(trimmed)) continue;
    if (/^[○]説明のため/.test(trimmed)) continue;
    if (/^[○]事務局出席/.test(trimmed)) continue;
    if (/^[○]議事の経過/.test(trimmed)) continue;
    if (/^[○]本日の会議/.test(trimmed)) continue;
    if (/^[○]付託議案/.test(trimmed)) continue;
    if (/^[○]会議の経過/.test(trimmed)) continue;
    if (/^[○]職務のため/.test(trimmed)) continue;

    // ページ番号行のノイズを除去（－ N－ パターン）
    const cleanedBlock = trimmed.replace(/－\s[０-９]+－/g, "");
    const normalized = cleanedBlock.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content) continue;

    const kind = classifyKind(speakerRole);
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind,
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
      `[212181-motosu] PDF 取得失敗: ${pdfUrl}`,
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
  params: MotosuDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日はリンクテキストから取得済みの場合はそれを使い、
  // なければ PDF 本文から抽出する
  const heldOn = params.heldOn ?? extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `motosu_${heldOn}_${params.sessionTitle}_${params.title}`,
    statements,
  };
}
