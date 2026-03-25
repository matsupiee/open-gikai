/**
 * 栗山町議会 — detail フェーズ
 *
 * HTML 会議録（Shift_JIS フレームセット）から発言データを抽出し、
 * MeetingData に変換する。
 *
 * フレームセット構成:
 *   {prefix}{YYMM}t.html        ← フレームセット親
 *   ├── {prefix}{YYMM}t-index.html  ← 左カラム目次
 *   └── {prefix}{YYMM}t01.html      ← 本文（日ごと）
 *
 * 旧形式（平成24〜令和3年前半）:
 *   {prefix}-n.html  ← フレームセット親
 *   ├── {prefix}-l.html  ← 目次
 *   └── {prefix}.html    ← 本文
 *
 * 近年形式（令和3年定例会以降）:
 *   発言: 〇<b>役職（氏名君）</b>　発言内容
 *   議事: ◎<b>議題名</b>
 *
 * 旧形式:
 *   発言: <td class="speakerXxx">○<span class="Xxx">役職（氏名君）</span></td>
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  detectMeetingType,
  fetchBinary,
  fetchShiftJisPage,
  parseDateString,
  resolveUrl,
} from "./shared";

// 役職サフィックス（長い方を先に配置して誤マッチを防ぐ）
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
  "係員",
];

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
  "副部長",
  "副課長",
  "書記",
  "係員",
]);

/**
 * 役職から発言種別を分類する。
 */
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
 * 「役職（氏名君）」形式のテキストから役職と氏名を抽出する。
 */
export function parseSpeakerLabel(label: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 全角スペース・半角スペースを除去して正規化
  const normalized = label.replace(/[\s　]+/g, "").trim();

  // パターン1: 役職（氏名君）
  const roleNameMatch = normalized.match(/^(.+?)（(.+?)）$/);
  if (roleNameMatch) {
    const roleOrName = roleNameMatch[1]!;
    const nameWithSuffix = roleNameMatch[2]!;
    // 「君」「氏」「さん」等の敬称を除去
    const name = nameWithSuffix.replace(/[君氏さん]$/, "");

    // 役職サフィックスにマッチする場合
    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrName.endsWith(suffix)) {
        return {
          speakerName: name || null,
          speakerRole: suffix,
        };
      }
    }

    // 役職が不明な場合: roleOrName を役職、name を氏名
    return {
      speakerName: name || null,
      speakerRole: roleOrName || null,
    };
  }

  // パターン2: 役職のみ（氏名なし）
  for (const suffix of ROLE_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      const name =
        normalized.length > suffix.length
          ? normalized.slice(0, -suffix.length)
          : null;
      return { speakerName: name, speakerRole: suffix };
    }
  }

  return { speakerName: normalized || null, speakerRole: null };
}

/**
 * 氏名から文字間スペースを除去し正規化する。
 * 例: "齊　藤　義　崇" → "齊藤義崇"
 */
function normalizeSpacedName(name: string): string {
  // 全角スペースが含まれている場合のみ除去（意図的な空白が含まれない場合）
  if (/　/.test(name)) {
    return name.replace(/　/g, "");
  }
  return name;
}

/**
 * 近年形式（令和3年定例会以降）の本文 HTML から発言を抽出する。
 *
 * 発言パターン:
 *   〇<b>議長（鵜川和彦君）</b>　発言内容
 *   ◎<b>開議の宣告</b>
 */
export function parseStatementsNew(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // HTML を行ごとに処理
  // <br> タグを改行に変換してから処理
  const text = html
    .replace(/<br\s*\/?>\s*/gi, "\n")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  const lines = text.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 〇 または ○ で始まる発言行
    if (/^[〇○]/.test(line)) {
      // <b>役職（氏名君）</b> を抽出
      const speakerMatch = line.match(/^[〇○]<b>(.+?)<\/b>([\s\S]*)/);
      if (speakerMatch) {
        const labelRaw = speakerMatch[1]!.replace(/<[^>]+>/g, "").trim();
        const restRaw = speakerMatch[2]!
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
          .replace(/[\s　]+/g, " ")
          .trim();

        const { speakerName, speakerRole } = parseSpeakerLabel(labelRaw);
        const content = restRaw;

        if (!content) continue;

        const normalizedName = speakerName
          ? normalizeSpacedName(speakerName)
          : null;
        const contentHash = createHash("sha256").update(content).digest("hex");
        const startOffset = offset;
        const endOffset = offset + content.length;

        statements.push({
          kind: classifyKind(speakerRole),
          speakerName: normalizedName,
          speakerRole,
          content,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
        continue;
      }
    }

    // ◎ で始まる議事進行行（発言として登録しない）
    if (/^◎/.test(line)) {
      continue;
    }
  }

  return statements;
}

/**
 * 旧形式（平成24年〜令和3年前半）の本文 HTML から発言を抽出する。
 *
 * <table class="type0"> 内の発言行を処理する。
 * 発言者 td: <td class="speakerXxx">
 * 本文 td: <td class="speechXxx">
 */
export function parseStatementsOld(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // <tr> ブロックを処理
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const trContent = trMatch[1]!;

    // 発言者 td を検索
    const speakerTdMatch = trContent.match(
      /<td[^>]*class=["'][^"']*speaker[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
    );
    if (!speakerTdMatch) continue;

    // 本文 td を検索
    const speechTdMatch = trContent.match(
      /<td[^>]*class=["'][^"']*speech[^"']*["'][^>]*>([\s\S]*?)<\/td>/i,
    );
    if (!speechTdMatch) continue;

    const speakerRaw = speakerTdMatch[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/[○◎〇]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const contentRaw = speechTdMatch[1]!
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ")
      .trim();

    if (!speakerRaw || !contentRaw) continue;

    const { speakerName, speakerRole } = parseSpeakerLabel(speakerRaw);
    const normalizedName = speakerName
      ? normalizeSpacedName(speakerName)
      : null;
    const contentHash = createHash("sha256").update(contentRaw).digest("hex");
    const startOffset = offset;
    const endOffset = offset + contentRaw.length;

    statements.push({
      kind: classifyKind(speakerRole),
      speakerName: normalizedName,
      speakerRole,
      content: contentRaw,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  return statements;
}

/**
 * 本文 HTML から発言を抽出する。
 * 近年形式と旧形式を自動判定する。
 */
export function parseStatements(html: string): ParsedStatement[] {
  // 旧形式の判定: <table class="type0"> が存在するか
  if (/<table[^>]+class=["'][^"']*type0[^"']*["']/i.test(html)) {
    return parseStatementsOld(html);
  }
  return parseStatementsNew(html);
}

/**
 * 本文 HTML から開催日を抽出する。
 *
 * <pre> タグ内の冒頭に日付が含まれることが多い。
 * 例: "令和７年１２月９日　午前　９時３０分開議"
 */
export function extractHeldOnFromContent(html: string): string | null {
  // <pre> タグ内を優先的に検索
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    const date = parseDateString(preMatch[1]!);
    if (date) return date;
  }

  // HTML 全体から日付を検索
  const plainText = html.replace(/<[^>]+>/g, " ");
  return parseDateString(plainText);
}

/**
 * フレームセット HTML からインデックスフレームと本文フレームの URL を抽出する。
 *
 * 近年形式:
 *   <frame src="{prefix}t-index.html" ...>
 *   <frame src="{prefix}t01.html" ...>
 *
 * 旧形式:
 *   <frame src="{prefix}-l.html" ...>
 *   <frame src="{prefix}.html" ...>
 */
export function parseFrameUrls(
  framesetHtml: string,
  framesetUrl: string,
): { indexUrl: string | null; contentUrls: string[] } {
  const framePattern = /<frame[^>]+src=["']([^"']+)["'][^>]*>/gi;
  const frames: string[] = [];

  for (const match of framesetHtml.matchAll(framePattern)) {
    frames.push(resolveUrl(match[1]!.trim(), framesetUrl));
  }

  // インデックスフレームを特定
  let indexUrl: string | null = null;
  const contentUrls: string[] = [];

  for (const url of frames) {
    const path = url.toLowerCase();
    if (path.includes("-index.html") || path.includes("-l.html")) {
      indexUrl = url;
    } else if (
      path.includes(".html") &&
      !path.includes("-title.html") &&
      !path.includes("-t.html")
    ) {
      contentUrls.push(url);
    }
  }

  return { indexUrl, contentUrls };
}

/**
 * インデックスフレーム HTML から本文フレームの URL 一覧を取得する。
 */
export function parseIndexFrameUrls(
  indexHtml: string,
  indexUrl: string,
): string[] {
  const urls: string[] = [];
  const linkPattern = /<a[^>]+href=["']([^"'#]+\.html[^"']*)["'][^>]*>/gi;

  for (const match of indexHtml.matchAll(linkPattern)) {
    const href = match[1]!.split("#")[0]!.trim();
    if (!href) continue;
    const url = resolveUrl(href, indexUrl);
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * HTML 会議録（フレームセット形式）から発言データを取得する。
 */
export async function fetchHtmlMeetingData(
  framesetUrl: string,
  title: string,
  sessionName: string,
  municipalityCode: string,
): Promise<MeetingData | null> {
  // フレームセット HTML を取得（Shift_JIS）
  const framesetHtml = await fetchShiftJisPage(framesetUrl);
  if (!framesetHtml) return null;

  const { indexUrl, contentUrls: directContentUrls } = parseFrameUrls(
    framesetHtml,
    framesetUrl,
  );

  // 本文フレーム URL を収集
  let contentUrls: string[] = directContentUrls;

  if (indexUrl) {
    // インデックスフレームから本文 URL を取得
    const indexHtml = await fetchShiftJisPage(indexUrl);
    if (indexHtml) {
      const fromIndex = parseIndexFrameUrls(indexHtml, indexUrl);
      if (fromIndex.length > 0) {
        contentUrls = fromIndex;
      }
    }
  }

  if (contentUrls.length === 0) return null;

  // 全本文フレームを順番に取得してパース
  const allStatements: ParsedStatement[] = [];
  let heldOn: string | null = null;
  let globalOffset = 0;

  for (const contentUrl of contentUrls) {
    const contentHtml = await fetchShiftJisPage(contentUrl);
    if (!contentHtml) continue;

    if (!heldOn) {
      heldOn = extractHeldOnFromContent(contentHtml);
    }

    const pageStatements = parseStatements(contentHtml);

    // offset を連続させる
    for (const stmt of pageStatements) {
      allStatements.push({
        ...stmt,
        startOffset: globalOffset + stmt.startOffset,
        endOffset: globalOffset + stmt.endOffset,
      });
    }

    if (pageStatements.length > 0) {
      const lastStmt = pageStatements[pageStatements.length - 1]!;
      globalOffset += lastStmt.endOffset + 1;
    }
  }

  if (allStatements.length === 0) return null;
  if (!heldOn) return null;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(sessionName),
    heldOn,
    sourceUrl: framesetUrl,
    externalId: `kuriyama_${framesetUrl.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "unknown"}`,
    statements: allStatements,
  };
}

/**
 * PDF 会議録から発言データを取得する。
 * unpdf でテキストを抽出し近年形式として処理する。
 */
export async function fetchPdfMeetingData(
  pdfUrl: string,
  title: string,
  sessionName: string,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  let pdfText: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    pdfText = text;
  } catch (e) {
    console.warn(
      `fetchPdfMeetingData: PDF parse failed for ${pdfUrl}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }

  if (!pdfText || pdfText.trim().length === 0) return null;

  const heldOn = parseDateString(pdfText);
  if (!heldOn) return null;

  const statements = parsePdfText(pdfText);
  if (statements.length === 0) return null;

  const pdfId = pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? "unknown";

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(sessionName),
    heldOn,
    sourceUrl: pdfUrl,
    externalId: `kuriyama_pdf_${pdfId}`,
    statements,
  };
}

/**
 * PDF テキストから発言を抽出する。
 * 発言パターン: 〇役職（氏名君） 発言内容
 */
export function parsePdfText(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^[〇○◯]/.test(line)) {
      // 発言者行
      const speakerMatch = line.match(
        /^[〇○◯]\s*(.+?（.+?）)\s*([\s\S]*)/,
      );
      if (speakerMatch) {
        const labelRaw = speakerMatch[1]!.trim();
        const content = speakerMatch[2]!.replace(/\s+/g, " ").trim();

        if (!content) continue;

        const { speakerName, speakerRole } = parseSpeakerLabel(labelRaw);
        const normalizedName = speakerName
          ? normalizeSpacedName(speakerName)
          : null;
        const contentHash = createHash("sha256").update(content).digest("hex");
        const startOffset = offset;
        const endOffset = offset + content.length;

        statements.push({
          kind: classifyKind(speakerRole),
          speakerName: normalizedName,
          speakerRole,
          content,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      }
    }
  }

  return statements;
}

/**
 * 会議録（HTML または PDF）から MeetingData を取得する。
 */
export async function fetchMeetingData(
  params: {
    url: string;
    format: "html" | "pdf";
    title: string;
    sessionName: string;
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (params.format === "html") {
    return fetchHtmlMeetingData(
      params.url,
      params.title,
      params.sessionName,
      municipalityCode,
    );
  }
  return fetchPdfMeetingData(
    params.url,
    params.title,
    params.sessionName,
    municipalityCode,
  );
}
