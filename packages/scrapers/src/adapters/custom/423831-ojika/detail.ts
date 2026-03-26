/**
 * 小値賀町議会 会議録 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（小値賀町の例）:
 *   ○議長（西村光雄君）　ただいまから会議を開きます。
 *   ○町長（西村久之君）　お答えいたします。
 *   ○１番（立石光助君）　質問いたします。
 *
 * マーカー: ○ (U+25CB), ◯ (U+25EF), 〇 (U+3007) のいずれか
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";
import type { OjikaPdfLink } from "./list";

export type OjikaDetailParams = OjikaPdfLink;

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
 *   ○議長（西村光雄君）　→ role=議長, name=西村光雄
 *   ○町長（西村久之君）　→ role=町長, name=西村久之
 *   ○１番（立石光助君）　→ role=議員, name=立石光助
 *   ○総務課課長（山田太郎君）→ role=課長, name=山田太郎
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
 * 小値賀町の会議録は ○ マーカーを使わない。
 * 発言者は「役職（氏名） 内容」の形式で記されている。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ○ マーカーが使われている場合はそちらで処理
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
 * ○ マーカーなしの形式（小値賀町標準形式）で ParsedStatement 配列を生成する。
 *
 * 発言者パターン: "役職（氏名）" が発言区切りとして機能する。
 * 例: "議長（宮﨑良保） 発言内容 ４番（今田光弘） 質問内容"
 */
function parseStatementsWithoutMarker(text: string): ParsedStatement[] {
  // 発言者パターン（役職（氏名） または 番号番（氏名））で分割
  // 全スペースを正規化してから処理
  const normalized = text.replace(/\s+/g, " ");

  // 会議開始前のヘッダー部分をスキップ
  // 「午前XX時XX分 開 議」の前後で本文が始まる
  const sessionStart = normalized.search(/午前\s*\d+\s*時\s*\d*\s*分\s*開\s*議/);
  const bodyText = sessionStart >= 0 ? normalized.slice(sessionStart) : normalized;

  // 発言区切りパターン: "役職（氏名）" の形式
  // 前後にスペースが必要（本文中の括弧と区別するため）
  const speakerHeaderPattern =
    /(?:(?:^|(?<=\s))(?:[\d０-９]+番|[^\s（）\d]{1,20})（[^）]{1,15}?(?:君|様|議員)?）(?=\s))/g;

  // マッチ位置を収集
  const matches: Array<{ index: number; fullMatch: string }> = [];
  let m: RegExpExecArray | null;
  speakerHeaderPattern.lastIndex = 0;
  while ((m = speakerHeaderPattern.exec(bodyText)) !== null) {
    matches.push({ index: m.index, fullMatch: m[0] });
  }

  if (matches.length === 0) return [];

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < matches.length; i++) {
    const { index, fullMatch } = matches[i]!;
    const nextIndex = i + 1 < matches.length ? matches[i + 1]!.index : bodyText.length;

    // 発言者ヘッダーから次の発言者ヘッダーまでを取得
    const block = bodyText.slice(index, nextIndex).trim();

    // 発言者情報を解析
    const { speakerName, speakerRole, content } = parseSpeakerFromBlock(block, fullMatch);
    if (!content || content.length < 3) continue;

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
 * 発言ブロックから発言者情報と内容を抽出する（マーカーなし形式）。
 * ブロック先頭に「役職（氏名） 発言内容」の形式で発言者が含まれる。
 */
function parseSpeakerFromBlock(
  block: string,
  fullMatch: string,
): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // fullMatch: "役職（氏名）" or "番号番（氏名）"
  const matchPattern = fullMatch.match(/^(.+?)（(.+?)(?:君|様|議員)?）$/);
  if (!matchPattern) {
    return { speakerName: null, speakerRole: null, content: block };
  }

  const rolePart = matchPattern[1]!.trim();
  const rawName = matchPattern[2]!.replace(/[\s\u3000]+/g, "").trim();

  // ブロックから発言者ヘッダーを除いたコンテンツ
  const headerLength = fullMatch.length;
  const content = block.slice(headerLength).trim();

  // 役職を判定
  let speakerRole: string | null = null;

  // 全角数字を半角に変換してチェック
  const halfWidthRole = rolePart.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );

  // 番号付き議員: "１番" → 議員
  if (/^\d+番$/.test(halfWidthRole)) {
    speakerRole = "議員";
  } else {
    // 役職サフィックスマッチ
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        speakerRole = suffix;
        break;
      }
    }
    if (!speakerRole) speakerRole = rolePart || null;
  }

  return { speakerName: rawName, speakerRole, content };
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
      `[423831-ojika] PDF 取得失敗: ${pdfUrl}`,
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
  params: OjikaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = params.heldOn ?? null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: heldOn as string,
    sourceUrl: params.pdfUrl,
    externalId: `ojika_${params.year}_${params.title}`,
    statements,
  };
}
