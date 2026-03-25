/**
 * 奥多摩町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、発言パターンで分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF より）:
 *   〇議長（田中一郎君）　ただいまから本日の会議を開きます。
 *   〇町長（鈴木次郎君）　お答えいたします。
 *   〇3番（佐藤花子君）　質問があります。
 *   〇総務課長（山田三郎君）　説明いたします。
 *
 * マーカー: 〇 (U+3007 IDEOGRAPHIC NUMBER ZERO)
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, detectMeetingType, normalizeFullWidth, deSpacePdfText } from "./shared";

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
  "所長",
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
  "所長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 〇 マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   〇議長（田中一郎君）　→ role=議長, name=田中一郎
 *   〇町長（鈴木次郎君）　→ role=町長, name=鈴木次郎
 *   〇3番（佐藤花子君）　 → role=議員, name=佐藤花子
 *   〇総務課長（山田三郎君）→ role=課長, name=山田三郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 〇 マーカーを除去
  const stripped = text.replace(/^〇\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s\u3000]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: 〇3番（佐藤花子君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方を先に）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // 〇 マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(/^([^\s\u3000]{1,30})[\s\u3000]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length ? header.slice(0, -suffix.length) : null;
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
 * 〇 (U+3007) マーカーで発言ブロックを分割する。
 */
export function parseStatements(rawText: string): ParsedStatement[] {
  // 全角文字を正規化し、PDF 抽出の文字間スペースを除去する
  const normalized = deSpacePdfText(normalizeFullWidth(rawText));

  const blocks = normalized.split(/(?=\u3007)/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^\u3007/.test(trimmed)) continue;

    // 議事日程・出席者リスト等の見出しはスキップ
    if (/^〇議事日程/.test(trimmed)) continue;
    if (/^〇出席議員/.test(trimmed)) continue;
    if (/^〇欠席議員/.test(trimmed)) continue;
    if (/^〇出席説明員/.test(trimmed)) continue;
    if (/^〇出席事務局/.test(trimmed)) continue;
    if (/^〇会議に出席/.test(trimmed)) continue;

    const blockNormalized = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(blockNormalized);
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
      `[133086-okutama] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: {
    pdfUrl: string;
    title: string;
    heldOn: string | null;
    meetingType: string;
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  // heldOn が解析できない場合は null を返す
  if (!meeting.heldOn) return null;

  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const filename =
    new URL(meeting.pdfUrl).pathname.split("/").pop()?.replace(/\.pdf$/i, "") ??
    null;
  const externalId = filename ? `okutama_${filename}` : null;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title) || meeting.meetingType,
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
