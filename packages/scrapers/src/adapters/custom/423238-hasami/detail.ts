/**
 * 波佐見町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ○議長（今井泰照君）　ただいまから会議を開きます。
 *   ○町長（一瀬政太君）　お答えいたします。
 *   ○２番（城後光君）　質問いたします。
 *   ○総務課長（村川浩記君）　お答えいたします。
 *
 * マーカー: ○ (U+25CB WHITE CIRCLE)
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { extractHeldOnFromText, fetchBinary } from "./shared";

export interface HasamiDetailParams {
  title: string;
  pdfUrl: string;
  meetingType: string;
  headingYear: number;
}

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
  "事務局長",
  "局長",
  "会計管理者",
  "管理者",
  "副部長",
  "部長",
  "副参事",
  "参事",
  "副課長",
  "課長",
  "係長",
  "所長",
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
  "教育次長",
  "事務局長",
  "局長",
  "会計管理者",
  "管理者",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "参事",
  "副参事",
  "係長",
  "所長",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（今井泰照君）　→ role=議長, name=今井泰照
 *   ○町長（一瀬政太君）　→ role=町長, name=一瀬政太
 *   ○２番（城後光君）　→ role=議員, name=城後光
 *   ○総務課長（村川浩記君）→ role=課長, name=村川浩記
 *   ○会計管理者兼会計課長（宮田和子君）→ role=会計管理者, name=宮田和子
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^○\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○２番（城後光君）
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
 * ○ (U+25CB) マーカーで分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=○)/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^○/.test(trimmed)) continue;

    // 議事日程など見出し項目をスキップ
    if (/^○議事日程/.test(trimmed)) continue;
    if (/^○出席議員/.test(trimmed)) continue;
    if (/^○欠席議員/.test(trimmed)) continue;
    if (/^○出席説明員/.test(trimmed)) continue;
    if (/^○出席事務局/.test(trimmed)) continue;
    if (/^○説明のため/.test(trimmed)) continue;
    if (/^○議会事務局職員/.test(trimmed)) continue;

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
      `[423238-hasami] PDF 取得失敗: ${pdfUrl}`,
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
  params: HasamiDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // PDF 本文から開催日を抽出
  const heldOn = extractHeldOnFromText(text);
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `hasami_${heldOn}_${params.title}`,
    statements,
  };
}
