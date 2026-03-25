/**
 * 木曽町議会 — detail フェーズ
 *
 * 記事詳細ページから PDF リンクを取得し、PDF テキストを抽出して MeetingData を組み立てる。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  type CategoryId,
  BASE_ORIGIN,
  buildArticleUrl,
  detectMeetingType,
  fetchBinary,
  fetchPage,
  parseJapaneseDate,
} from "./shared";
import type { KisoArticle } from "./list";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副部長",
  "副課長",
  "議長",
  "町長",
  "委員",
  "議員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "書記",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "書記",
  "副部長",
  "副課長",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+/);
  if (!headerMatch?.[1]) {
    return { speakerName: null, speakerRole: null, content: stripped.trim() };
  }

  const header = headerMatch[1];
  const content = stripped.slice(headerMatch[0].length).trim();

  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const name =
        header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix, content };
    }
  }

  if (/^[○◯◎●]/.test(text)) {
    return { speakerName: header, speakerRole: null, content };
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "question" | "answer" | "remark" {
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
 * テキストから発言を抽出する。
 * 行頭の ◯ マーカーで話者を識別する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split("\n");
  let currentSpeaker: { name: string | null; role: string | null } | null = null;
  let currentContent: string[] = [];

  const flushStatement = () => {
    if (currentContent.length === 0) return;
    const content = currentContent.join(" ").replace(/\s+/g, " ").trim();
    if (!content || content.length < 3) {
      currentContent = [];
      return;
    }
    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(currentSpeaker?.role ?? null),
      speakerName: currentSpeaker?.name ?? null,
      speakerRole: currentSpeaker?.role ?? null,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
    currentContent = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hasMarker = /^[○◯◎●]/.test(trimmed);
    if (hasMarker) {
      flushStatement();
      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeaker = { name: speakerName, role: speakerRole };
      if (content) {
        currentContent.push(content);
      }
    } else {
      currentContent.push(trimmed);
    }
  }
  flushStatement();

  return statements;
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する。
 */
export function parsePdfLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /href=["'](\/files\/file\/box\/[^"']+\.pdf)["']/gi;
  for (const match of html.matchAll(regex)) {
    if (match[1]) {
      links.push(match[1]);
    }
  }
  return [...new Set(links)];
}

/**
 * 詳細ページの HTML から更新日（更新日 : 令和XX年XX月XX日）を抽出する。
 */
export function parseUpdateDate(html: string): string | null {
  // <p>更新日 : 令和XX年XX月XX日（曜日）</p>
  const match = html.match(/更新日\s*[:：]\s*([^<\n（(]+)/);
  if (!match?.[1]) return null;
  return parseJapaneseDate(match[1].trim());
}

/**
 * PDF バイナリからテキストを抽出する。
 */
async function extractTextFromPdf(data: Uint8Array): Promise<string | null> {
  try {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    return text ?? null;
  } catch (e) {
    console.warn("[kiso] pdf text extraction failed", e);
    return null;
  }
}

/**
 * 記事詳細ページから MeetingData を組み立てる。
 */
export async function fetchArticleDetail(
  article: KisoArticle & { categoryId: CategoryId },
  municipalityCode: string,
): Promise<MeetingData | null> {
  const url = buildArticleUrl(article.categoryId, article.articleId);
  const html = await fetchPage(url);
  if (!html) return null;

  const pdfLinks = parsePdfLinks(html);
  const updateDate = parseUpdateDate(html);

  if (pdfLinks.length === 0) {
    // PDF なし → statements なし → null
    return null;
  }

  // 全 PDF からテキストを収集して発言を抽出
  const allStatements: ParsedStatement[] = [];

  for (const pdfPath of pdfLinks) {
    const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;
    const data = await fetchBinary(pdfUrl);
    if (!data) continue;

    const text = await extractTextFromPdf(data);
    if (!text) continue;

    const stmts = parseStatements(text);
    allStatements.push(...stmts);
  }

  if (allStatements.length === 0) return null;

  const heldOn = updateDate;
  if (!heldOn) return null;

  return {
    municipalityCode,
    title: article.title,
    meetingType: detectMeetingType(article.title),
    heldOn,
    sourceUrl: url,
    externalId: `kiso_${article.categoryId}_${article.articleId}`,
    statements: allStatements,
  };
}
