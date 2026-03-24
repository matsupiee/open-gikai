/**
 * みなかみ町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（ドキュメントより）:
 *   議　長（小林　洋君）　おはようございます。
 *   町　長（阿部賢一君）　皆さん、おはようございます。
 *   ◇　石坂　武　君・・・１．町長、公約実現への取り組み（一般質問者リスト）
 *
 * 発言者識別: `{役職}（{氏名}君）` パターン（役職に全角スペースあり）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchBinary, normalizeFullWidth, deSpacePdfText } from "./shared";

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
 * みなかみ町のパターン（全角スペースを正規化後）:
 *   "議 長（小林 洋君）  おはようございます。"
 *   → role="議長", name="小林洋"
 *
 *   "町 長（阿部賢一君）  お答えします。"
 *   → role="町長", name="阿部賢一"
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 全角スペースを半角に変換してから処理
  const normalized = normalizeFullWidth(text);

  // パターン: role（name + 君|様）content
  const match = normalized.match(
    /^(.+?)[（(](.+?)(?:君|様)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    // 役職から空白を除去（例: "議 長" → "議長"）
    const rolePart = match[1]!.replace(/\s+/g, "").trim();
    const rawName = match[2]!.replace(/\s+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: "3番（佐藤太郎君）"
    if (/^[\d]+番$/.test(rolePart)) {
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
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * みなかみ町の発言者を識別するパターン。
 *
 * 役職は既知のサフィックスで終わる漢字列、または番号議員（n番）。
 * 氏名は括弧内に入り「君」または「様」で終わる。
 * 次の発言者の開始位置を lookahead で検出するために使用する。
 *
 * 例: 議長（石坂武君）、町長（阿部賢一君）、総務課長（高野明夫君）
 */
const SPEAKER_RE =
  /(?:副委員長|委員長|副議長|議長|副町長|町長|副教育長|教育長|事務局長|局長|副部長|部長|副課長|課長|室長|係長|参事|主幹|主査|補佐|議員|委員|[\d０-９]+番)[（(][^（(）)]{1,20}(?:君|様)[）)]/g;

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * みなかみ町の PDF テキストは unpdf で1本の文字列として抽出される。
 * 発言者は `{役職}（{氏名}君）{発言内容}` パターンで識別する。
 *
 * PDF テキストは文字間にスペースが入るため、事前に deSpacePdfText で正規化する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  // まず全角文字を正規化し、その後 PDF 抽出の文字間スペースを除去する
  const normalized = deSpacePdfText(normalizeFullWidth(rawText));

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

    // 発言者ヘッダー + 発言内容のブロック
    const block = normalized.slice(current.index, nextIndex).trim();
    if (!block) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content) continue;

    // ト書き（登壇等）のみは無視
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
      `[104493-minakami] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: { pdfUrl: string; title: string; heldOn: string | null },
  municipalityId: string,
): Promise<MeetingData | null> {
  // heldOn が解析できない場合は null を返す（フォールバック値禁止）
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: PDF ファイル名から生成
  const filename = new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
  const externalId = filename ? `minakami_${filename}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
