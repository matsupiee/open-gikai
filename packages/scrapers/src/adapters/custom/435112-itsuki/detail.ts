/**
 * 五木村議会 会議録 — detail フェーズ
 *
 * 詳細ページから PDF URL を取得し、MeetingData を組み立てる。
 * 会議録は PDF 形式のため、発言テキストの抽出は行わず
 * PDF を単一の statement として登録する。
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { BASE_ORIGIN, convertJapaneseYear, fetchPage } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set<string>(["村長", "副村長"]);

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
 * 会議名パターンから開催日を推定する。
 * 例: "五木村議会会議録（令和6年第3回定例会）" → "2024-01-01"（年のみ確定、月日は不明）
 *
 * heldOn が解析できない場合は null を返す。
 */
export function parseHeldOn(title: string): string | null {
  const sessionPattern = /[（(](令和|平成|昭和)(\d+)年第(\d+)回(定例会|臨時会)[）)]/;
  const m = title.match(sessionPattern);
  if (!m) return null;

  const era = m[1];
  const yearNum = parseInt(m[2]!, 10);
  if (!era || isNaN(yearNum)) return null;

  const year = convertJapaneseYear(era, yearNum);
  // 月日は会議録 PDF 内にのみ含まれるため、年のみを使用
  return `${year}-01-01`;
}

/**
 * 会議名から meetingType を判定する。
 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する。
 * 最初に見つかった .pdf リンクを返す。
 */
export function parsePdfUrl(html: string, articleUrl: string): string | null {
  // <a href="...pdf"> 形式のリンクを抽出
  const pdfRegex = /<a\s+[^>]*href=["']([^"']*\.pdf)["'][^>]*>/gi;
  for (const match of html.matchAll(pdfRegex)) {
    const href = match[1];
    if (!href) continue;

    if (href.startsWith("http")) return href;

    // 相対 URL を絶対 URL に変換
    // articleUrl: https://www.vill.itsuki.lg.jp/kiji0032032/index.html
    const base = articleUrl.replace(/\/[^/]+$/, "/");
    return href.startsWith("/") ? `${BASE_ORIGIN}${href}` : `${base}${href}`;
  }
  return null;
}

/**
 * 詳細ページの HTML からページタイトルを抽出する。
 * class="title" の H1 を優先し、なければ全 H1 を順に試す。
 * 最後の手段として <title> タグを使用する。
 */
export function parseTitle(html: string): string | null {
  // class="title" の H1 を優先（五木村サイトは空の h1#hd_header と h1.title の2つが存在する）
  const h1TitleMatch = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1TitleMatch?.[1]) {
    const text = h1TitleMatch[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text;
  }

  // 全 H1 を順に試し、空でないものを使う
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  for (const match of html.matchAll(h1Regex)) {
    const text = (match[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text;
  }

  // <title> タグにフォールバック
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    return titleMatch[1]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim() || null;
  }

  return null;
}

/**
 * 詳細ページから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  articleUrl: string,
  municipalityId: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(articleUrl);
  if (!html) return null;

  const title = parseTitle(html);
  if (!title) return null;

  const pdfUrl = parsePdfUrl(html, articleUrl);
  const heldOn = parseHeldOn(title);
  if (!heldOn) return null;

  // PDF URL がある場合は PDF を単一の statement として登録
  const statements: ParsedStatement[] = [];

  if (pdfUrl) {
    const content = `会議録PDF: ${pdfUrl}`;
    const contentHash = createHash("sha256").update(content).digest("hex");
    statements.push({
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content,
      contentHash,
      startOffset: 0,
      endOffset: content.length,
    });
  }

  if (statements.length === 0) return null;

  // 記事 ID を externalId として使用
  const kijiMatch = articleUrl.match(/kiji(\d+)/);
  const externalId = kijiMatch?.[1] ? `itsuki_kiji${kijiMatch[1]}` : null;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: articleUrl,
    externalId,
    statements,
  };
}
