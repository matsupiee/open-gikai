/**
 * 品川区議会 会議録検索システム — detail フェーズ
 *
 * ドキュメントページから全発言を取得し、MeetingData に変換する。
 *
 * 発言は <li> 要素内に格納され、◯マーカーで話者を識別する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { buildDocumentUrl, detectMeetingType, fetchPage } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "委員長",
  "副委員長",
  "副議長",
  "副区長",
  "副部長",
  "副課長",
  "議長",
  "区長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "区長",
  "副区長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "副部長",
  "副課長",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 * フォーマット: "◯渡辺議長 ただいまから本日の会議を開きます。"
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 先頭の名前+役職部分を取得（スペースまで）
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = stripped.slice(headerMatch[0].length).trim();

  // 役職サフィックスにマッチする場合: "渡辺議長" → name=渡辺, role=議長
  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  // ◯マーカーがある場合、役職が不明でも先頭を名前として扱う
  if (/^[○◯◎●]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (speakerRole === "議長" || speakerRole === "副議長" || speakerRole === "委員長")
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * ドキュメントページの HTML から発言を抽出する。
 *
 * 各 <li> 内で ◯ マーカーに続く話者名と本文を取得する。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let offset = 0;

  for (const liMatch of html.matchAll(liRegex)) {
    const liContent = liMatch[1];
    if (!liContent) continue;

    // HTML タグを除去してプレーンテキストにする
    const plainText = liContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();

    if (!plainText) continue;

    const hasMarker = /^[○◯◎●]/.test(plainText);
    const normalized = plainText.replace(/\s+/g, " ").trim();

    if (hasMarker) {
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
    } else if (normalized.length > 10) {
      const contentHash = createHash("sha256").update(normalized).digest("hex");
      const startOffset = offset;
      const endOffset = offset + normalized.length;
      statements.push({
        kind: "remark",
        speakerName: null,
        speakerRole: null,
        content: normalized,
        contentHash,
        startOffset,
        endOffset,
      });
      offset = endOffset + 1;
    }
  }

  return statements;
}

/**
 * ドキュメント Id から発言データを取得する。
 */
export async function fetchDocumentStatements(
  documentId: string,
): Promise<ParsedStatement[] | null> {
  const url = buildDocumentUrl(documentId);
  const html = await fetchPage(url);
  if (!html) return null;

  const statements = parseStatements(html);
  return statements.length > 0 ? statements : null;
}

/**
 * ドキュメント情報から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: { documentId: string; title: string; heldOn: string },
  municipalityId: string,
): Promise<MeetingData | null> {
  const statements = await fetchDocumentStatements(doc.documentId);
  if (!statements) return null;

  return {
    municipalityId,
    title: doc.title,
    meetingType: detectMeetingType(doc.title),
    heldOn: doc.heldOn,
    sourceUrl: buildDocumentUrl(doc.documentId),
    externalId: `shinagawa_${doc.documentId}`,
    statements,
  };
}
