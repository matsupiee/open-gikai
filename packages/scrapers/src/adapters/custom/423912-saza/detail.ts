/**
 * 佐々町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（佐々町の例）:
 *   ○議長（山口政明君）　ただいまから会議を開きます。
 *   ○町長（宮本道治君）　お答えいたします。
 *   ○１番（山下義広君）　質問いたします。
 *
 * マーカー: ○ (U+25CB), ◯ (U+25EF), 〇 (U+3007) のいずれか
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";
import type { SazaPdfLink } from "./list";

export type SazaDetailParams = SazaPdfLink;

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
  "教育次長",
  "議会事務局長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "係長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "会計管理者",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "教育次長",
  "議会事務局長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "係長",
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "会計管理者",
]);

/** 全角数字を半角に変換（detail 内ローカル用） */
function toHalfWidthLocal(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山口政明君）　→ role=議長, name=山口政明
 *   ○町長（宮本道治君）　→ role=町長, name=宮本道治
 *   ○１番（山下義広君）　→ role=議員, name=山下義広
 *   ○総務課課長（田中太郎君）→ role=課長, name=田中太郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○◯〇 いずれのマーカーも除去
  const stripped = text.replace(/^[○◯〇]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○１番（XX君）
    if (/^[\d０-９]+番$/.test(toHalfWidthLocal(rolePart))) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方から順に）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
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
 *
 * 佐々町の会議録は ○ マーカーを使わない。
 * PDF 抽出テキストには役職・氏名の各文字間にスペースが挿入されている。
 *
 * 例: " 議 長（淡田 邦夫 君） おはようございます。"
 *      " ９ 番（須藤 敏規 君） 質問します。"
 *      " 町 長（古庄 剛 君） お答えします。"
 *
 * ○ マーカーがある場合はそちらで処理する（互換性）。
 */
export function parseStatements(text: string): ParsedStatement[] {
  if (/[○◯〇]/.test(text)) {
    return parseStatementsWithMarker(text);
  }
  return parseStatementsWithoutMarker(text);
}

/**
 * ○ マーカーで分割して ParsedStatement 配列を生成する。
 */
function parseStatementsWithMarker(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯〇])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇]/.test(trimmed)) continue;

    // 議事日程などの見出し項目をスキップ
    if (/^[○◯〇]議事日程/.test(trimmed)) continue;
    if (/^[○◯〇]出席議員/.test(trimmed)) continue;
    if (/^[○◯〇]欠席議員/.test(trimmed)) continue;
    if (/^[○◯〇]出席説明員/.test(trimmed)) continue;
    if (/^[○◯〇]出席事務局/.test(trimmed)) continue;
    if (/^[○◯〇]説明のため/.test(trimmed)) continue;
    if (/^[○◯〇]職務のため/.test(trimmed)) continue;
    if (/^[○◯〇]本日の会議/.test(trimmed)) continue;
    if (/^[○◯〇]欠\s*員/.test(trimmed)) continue;

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
 * CJK 文字間の単一スペースを除去して正規化する。
 * PDF 抽出時に挿入された文字間スペースを取り除く。
 *
 * 例: "議 長" → "議長", "淡田 邦夫" → "淡田邦夫", "９ 番" → "９番"
 */
function normalizeCjkSpaces(str: string): string {
  return str.replace(/(?<=[\u4e00-\u9fff\uff10-\uff19\u3040-\u30ff]) (?=[\u4e00-\u9fff\uff10-\uff19\u3040-\u30ff])/g, "");
}

/**
 * ○ マーカーなしの形式（佐々町標準形式）で ParsedStatement 配列を生成する。
 *
 * 発言区切りパターン: "役職（氏名 君）" の形式（前後にスペース）
 * PDF 抽出テキストでは役職や氏名の各文字間にスペースが挿入されている。
 *
 * 例: " 議 長（淡田 邦夫 君） 発言..."
 *      " ９ 番（須藤 敏規 君） 発言..."
 */
function parseStatementsWithoutMarker(text: string): ParsedStatement[] {
  // 全スペースを正規化（改行→スペース等）
  const normalized = text.replace(/\r\n|\r|\n/g, " ").replace(/\s{2,}/g, " ");

  // 審議経過開始マーカーを探して本文を切り出す
  const sessionStart = normalized.search(/審議の経過|開会|開議/);
  const bodyText = sessionStart >= 0 ? normalized.slice(sessionStart) : normalized;

  // 発言区切りパターン:
  //   スペース + 役職(CJK+空白混在) + （ + 氏名(CJK+空白混在) + 君） + スペース
  // 数字+番 のパターン（議員）も含む
  const speakerHeaderPattern =
    / ([\u4e00-\u9fff\uff10-\uff190-9\s]{1,20}番?)[（(]([\u4e00-\u9fff\uff10-\uff19a-zA-Z\s]{1,20})[君様][）)] /g;

  const matches: Array<{
    index: number;
    rawRole: string;
    rawName: string;
    fullMatch: string;
  }> = [];

  let m: RegExpExecArray | null;
  speakerHeaderPattern.lastIndex = 0;
  while ((m = speakerHeaderPattern.exec(bodyText)) !== null) {
    matches.push({
      index: m.index,
      rawRole: m[1]!,
      rawName: m[2]!,
      fullMatch: m[0],
    });
  }

  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const { index, rawRole, rawName, fullMatch } = matches[i]!;
    const nextIndex =
      i + 1 < matches.length ? matches[i + 1]!.index : bodyText.length;

    // 発言ヘッダーの次の文字から次の発言者まで
    const headerEnd = index + fullMatch.length;
    const rawContent = bodyText.slice(headerEnd, nextIndex).trim();

    if (!rawContent || rawContent.length < 3) continue;

    // CJK 文字間スペースを除去して役職・氏名を正規化
    const normalizedRole = normalizeCjkSpaces(rawRole.trim());
    const normalizedName = normalizeCjkSpaces(rawName.trim());

    // 役職を判定
    let speakerRole: string | null = null;

    const halfWidthRole = toHalfWidthLocal(normalizedRole);

    if (/^\d+番$/.test(halfWidthRole)) {
      speakerRole = "議員";
    } else {
      for (const suffix of ROLE_SUFFIXES) {
        if (normalizedRole === suffix || normalizedRole.endsWith(suffix)) {
          speakerRole = suffix;
          break;
        }
      }
      if (!speakerRole) speakerRole = normalizedRole || null;
    }

    const speakerName = normalizedName || null;

    // コンテンツも正規化
    const content = rawContent.replace(/\s+/g, " ").trim();

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
      `[423912-saza] PDF 取得失敗: ${pdfUrl}`,
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
  params: SazaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = params.heldOn ?? null;
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `saza_${params.year}_${params.title}`,
    statements,
  };
}
