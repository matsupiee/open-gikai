/**
 * 羽幌町議会 — detail フェーズ
 *
 * PDF（H25以降）と HTML（H18〜H24）の2パターンで発言を抽出する。
 *
 * PDF 発言フォーマット（○マーカーベース）:
 *   ○議長（森　淳君）　ただいまから本日の会議を開きます。
 *
 * HTML 発言フォーマット:
 *   〇議長（森　淳君）
 *   〇町長（舟橋泰博君）
 *   〇11番（磯野直君）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { HaboroMeeting } from "./list";
import { detectMeetingType, fetchBinary, fetchPage } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副市長",
  "副区長",
  "副村長",
  "町長",
  "市長",
  "区長",
  "村長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "副教育長",
  "教育長",
  "事務局長",
  "局長",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "市長",
  "副市長",
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
 * ○/〇 マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   〇議長（森　淳君）　→ role=議長, name=森淳
 *   〇町長（舟橋泰博君）→ role=町長, name=舟橋泰博
 *   〇11番（磯野直君）  → role=議員, name=磯野直
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯〇◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: 〇11番（磯野直君）
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
  speakerRole: string | null
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
 * テキストを ParsedStatement 配列に変換する。
 * ○/〇/◯/◎/● マーカーで発言ブロックに分割する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯〇◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯〇◎●]/.test(trimmed)) continue;

    // ◎ の議事進行見出し（◎開議の宣告 等）はスキップ
    if (/^◎/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯〇◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
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
      `[014842-haboro] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * HTML 会議録からテキストを抽出する。
 * <p> タグと改行で構成されたテキストを取得する。
 */
async function fetchHtmlText(htmlUrl: string): Promise<string | null> {
  const html = await fetchPage(htmlUrl);
  if (!html) return null;

  // <body> 内のテキストを抽出（HTML タグを除去）
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1]! : html;

  // <br>, <p>, </p> をなるべく改行に変換し、他のタグを除去
  const text = bodyHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .trim();

  return text || null;
}

/**
 * 会議録をダウンロードし MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: HaboroMeeting,
  municipalityCode: string
): Promise<MeetingData | null> {
  let text: string | null;

  if (meeting.format === "pdf") {
    text = await fetchPdfText(meeting.url);
  } else {
    text = await fetchHtmlText(meeting.url);
  }

  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: URL のパス部分からキーを生成
  const urlPath = new URL(meeting.url).pathname;
  const pathKey = urlPath
    .replace(/^\/gikai-iinkai\/gikai\/gijiroku\//, "")
    .replace(/\.[^.]+$/, "")
    .replace(/\//g, "_");
  const externalId = `haboro_${pathKey}`;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.section || meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.url,
    externalId,
    statements,
  };
}
