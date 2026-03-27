/**
 * 江別市議会 会議録 — detail フェーズ
 *
 * 会議録ページを取得し、MeetingData に変換する。
 *
 * HTML 構造:
 *   <h2>令和7年第1回江別市議会定例会会議録（第1号）令和7年2月20日</h2>
 *   <h3>◎ セクション見出し</h3>
 *   <h4>役職（氏名君）</h4>
 *   <p>発言内容...</p> or プレーンテキスト
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  convertJapaneseDateToISO,
  detectMeetingType,
  fetchPage,
  stripHtml,
} from "./shared";

// 行政側の役職パターン（答弁者として分類する）
const ANSWER_ROLE_PATTERN =
  /^(市長|副市長|教育長)$|(?:部長|課長|室長|事務長|次長|局長|参事|主幹|技監|管理者)$/;

/**
 * h1/h2 タイトルからタイトルテキストを抽出する。
 * 実際のサイトでは会議録タイトルは h1 に置かれる。
 * 「会議録」を含む or 「令和/平成」で始まる h1/h2 を対象とする。
 */
export function extractTitle(html: string): string | null {
  const headingRegex = /<(h[12])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    const text = stripHtml(match[2]!).trim();
    if (text.includes("会議録") || /^(令和|平成)/.test(text)) {
      return text;
    }
  }
  return null;
}

/**
 * 発言者テキストをパースする。
 *
 * パターン:
 *   "議長（島田泰美君）"     → { role: "議長", name: "島田泰美" }
 *   "市長（後藤好人君）"     → { role: "市長", name: "後藤好人" }
 *   "佐々木聖子君"           → { role: null, name: "佐々木聖子" }
 *   "１番（岩田優太君）"     → { role: null, name: "岩田優太" }
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
} | null {
  if (!text) return null;

  // パターン1: "役職（氏名君）" or "役職(氏名君)"
  const roleNameMatch = text.match(/^(.+?)[（(](.+?)[君さん]?[）)]$/);
  if (roleNameMatch) {
    const rawRole = roleNameMatch[1]!.trim();
    const name = roleNameMatch[2]!.replace(/[君さん]$/, "").trim();
    // 番号のみの役職（"１番" 等）は議員番号なので role を null にする
    const role = /^[０-９\d]+番$/.test(rawRole) ? null : rawRole;
    return { speakerName: name, speakerRole: role };
  }

  // パターン2: "氏名君" (役職なし)
  const nameOnlyMatch = text.match(/^(.+?)[君さん]$/);
  if (nameOnlyMatch) {
    return { speakerName: nameOnlyMatch[1]!.trim(), speakerRole: null };
  }

  // パターン3: 氏名のみ（短い文字列）
  if (text.length > 0 && text.length < 20) {
    return { speakerName: text, speakerRole: null };
  }

  return null;
}

/** 役職から発言種別を分類 */
export function classifyKind(role: string | null): string {
  if (!role) return "question";
  if (/^(議長|副議長)$/.test(role)) return "remark";
  if (/常任委員長$/.test(role)) return "remark";
  if (/委員長$/.test(role)) return "remark";
  if (ANSWER_ROLE_PATTERN.test(role)) return "answer";
  if (/^(監査委員|選挙管理委員)/.test(role)) return "answer";
  return "question";
}

/**
 * メインコンテンツ領域を抽出する。
 */
function extractContentArea(html: string): string {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1]!;

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1]!;

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1]! : html;
}

/** h4 間のテキストを発言内容としてクリーンアップする */
function cleanContent(html: string): string {
  return html
    .replace(/<h3[^>]*>[\s\S]*?<\/h3>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * HTML から発言ブロックをパースする。
 *
 * <h4>役職（氏名君）</h4> の後に続くテキストが1発言ブロック。
 * ◎ / ○ 付きの h4 はセクション見出しなのでスキップする。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  const contentHtml = extractContentArea(html);

  // h4 タグの位置をすべて取得
  const h4Regex = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  const h4Blocks: Array<{
    speakerHtml: string;
    startIndex: number;
    endIndex: number;
  }> = [];

  let h4Match: RegExpExecArray | null;
  while ((h4Match = h4Regex.exec(contentHtml)) !== null) {
    h4Blocks.push({
      speakerHtml: h4Match[1]!,
      startIndex: h4Match.index,
      endIndex: h4Match.index + h4Match[0].length,
    });
  }

  let offset = 0;

  for (let i = 0; i < h4Blocks.length; i++) {
    const block = h4Blocks[i]!;
    const speakerText = stripHtml(block.speakerHtml).trim();

    // ◎ / ○ 付きのセクション見出しはスキップ
    if (speakerText.startsWith("◎") || speakerText.startsWith("○")) continue;

    const speaker = parseSpeaker(speakerText);
    if (!speaker) continue;

    // 次の h4 タグまでのテキストを発言内容として取得
    const contentStart = block.endIndex;
    const contentEnd =
      i + 1 < h4Blocks.length
        ? h4Blocks[i + 1]!.startIndex
        : contentHtml.length;

    const rawContent = contentHtml.slice(contentStart, contentEnd);
    const content = cleanContent(rawContent);
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speaker.speakerRole),
      speakerName: speaker.speakerName,
      speakerRole: speaker.speakerRole,
      content,
      contentHash,
      startOffset: offset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

/**
 * 会議録ページから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: { pageId: string; url: string; section: string },
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(doc.url);
  if (!html) return null;

  const title = extractTitle(html);
  if (!title) return null;

  const heldOn = convertJapaneseDateToISO(title);
  if (!heldOn) return null;

  const statements = parseStatements(html);

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title, doc.section),
    heldOn,
    sourceUrl: doc.url,
    externalId: `ebetsu_${doc.pageId}`,
    statements,
  };
}
