/**
 * 安堵町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言者パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（○マーカーなし）:
 *   議長（淺野 勉） 只今から、令和６年第１回安堵町議会定例会を開会いたします。
 *   町長（西本安博） お答えいたします。
 *   ４番（福井保夫） 質問いたします。
 *   住民生活部長（吉田一弘） お答えいたします。
 *   教育長（辰己秀雄） お答えいたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface AndoDetailParams {
  title: string;
  heldOn: string;
  pdfUrl: string;
  meetingType: string;
  articleId: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "教育次長",
  "教育長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "事務局長",
  "室長",
  "局長",
  "係長",
  "次長",
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
  "教育次長",
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
]);

/**
 * 発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   議長（淺野 勉）      → role=議長, name=淺野勉
 *   町長（西本安博）      → role=町長, name=西本安博
 *   ４番（福井保夫）      → role=議員, name=福井保夫
 *   住民生活部長（吉田一弘）→ role=部長, name=吉田一弘
 *   議会選出監査委員（近藤晃一）→ role=委員, name=近藤晃一
 */
export function parseSpeaker(header: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // パターン: role（name）
  const match = header.match(/^(.+?)[（(]([^）)]+)[）)]/);
  if (!match) {
    return { speakerName: null, speakerRole: null };
  }

  const rolePart = match[1]!.trim();
  const rawName = match[2]!.replace(/[\s　]+/g, "").trim();

  // 番号付き議員: ４番（福井保夫）
  if (/^[\d０-９]+番$/.test(rolePart)) {
    return { speakerName: rawName, speakerRole: "議員" };
  }

  // 役職マッチ
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return { speakerName: rawName, speakerRole: suffix };
    }
  }

  return { speakerName: rawName, speakerRole: rolePart || null };
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
 * 発言者ヘッダーの正規表現パターン。
 *
 * 安堵町の議事録は○マーカーなしで、発言者は以下の形式:
 *   議長（name） / 町長（name） / ４番（name） / 住民生活部長（name）
 *
 * ただしト書き（登壇・退席等）のカッコ表記を除外するため、
 * カッコ前に役職・番号が必要。
 */
const SPEAKER_PATTERN =
  /(?:[\d０-９]+番|(?:[^\s（(）)]*?(?:副委員長|委員長|副議長|議長|副町長|町長|教育次長|教育長|副部長|部長|副課長|課長|事務局長|室長|局長|係長|次長|参事|主幹|主査|補佐|議員|委員)))[（(][^）)]+[）)]/g;

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // 発言者ヘッダーの位置を特定
  const headers: { index: number; header: string }[] = [];
  for (const m of text.matchAll(SPEAKER_PATTERN)) {
    const header = m[0];
    // ト書き（登壇・退席等）をスキップ
    if (/登壇|退席|退場|着席/.test(header)) continue;
    headers.push({ index: m.index, header });
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (let i = 0; i < headers.length; i++) {
    const current = headers[i]!;
    const next = headers[i + 1];

    // 発言本文を抽出（ヘッダー末尾からの残り ～ 次のヘッダーの前）
    const contentStart = current.index + current.header.length;
    const contentEnd = next ? next.index : text.length;
    const rawContent = text.slice(contentStart, contentEnd).trim();

    if (!rawContent) continue;

    // ページ番号や不要な空白を除去
    const content = rawContent
      .replace(/^\s+/, "")
      .replace(/\s*\d+\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!content) continue;

    const { speakerName, speakerRole } = parseSpeaker(current.header);

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
      `[293458-ando] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: AndoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  const statements = text ? parseStatements(text) : [];

  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId: `ando_${params.articleId}_${params.heldOn}`,
    statements,
  };
}
