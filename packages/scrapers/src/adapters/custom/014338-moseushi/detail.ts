/**
 * 妹背牛町議会 — detail フェーズ
 *
 * 詳細ページから PDF リンクを収集し、PDF テキストを抽出して発言データを生成する。
 *
 * 詳細ページのパターン:
 *   - 平成28年〜現在: HTML 中間ページ（PDF へのリンクを含む）
 *   - 令和元年第2回〜平成29年第3回の一部: 一覧ページから直接 PDF にリンク
 *
 * PDF テキスト抽出: unpdf を使用
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import {
  detectMeetingType,
  fetchBinary,
  fetchPage,
  parseDateString,
  parsePdfFilenameDate,
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

// 行政側の役職
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
  const normalized = label.replace(/[\s　]+/g, "").trim();

  // パターン1: 役職（氏名君）
  const roleNameMatch = normalized.match(/^(.+?)（(.+?)）$/);
  if (roleNameMatch) {
    const roleOrName = roleNameMatch[1]!;
    const nameWithSuffix = roleNameMatch[2]!;
    const name = nameWithSuffix.replace(/[君氏さん]$/, "");

    for (const suffix of ROLE_SUFFIXES) {
      if (roleOrName.endsWith(suffix)) {
        return {
          speakerName: name || null,
          speakerRole: suffix,
        };
      }
    }

    return {
      speakerName: name || null,
      speakerRole: roleOrName || null,
    };
  }

  // パターン2: 役職のみ
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
 * PDF テキストから発言を抽出する。
 * 発言パターン: 〇役職（氏名君） 発言内容
 */
export function parsePdfStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const lines = text.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^[〇○◯]/.test(line)) {
      const speakerMatch = line.match(/^[〇○◯]\s*(.+?（.+?）)\s*([\s\S]*)/);
      if (speakerMatch) {
        const labelRaw = speakerMatch[1]!.trim();
        const content = speakerMatch[2]!.replace(/\s+/g, " ").trim();

        if (!content) continue;

        const { speakerName, speakerRole } = parseSpeakerLabel(labelRaw);
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
    }
  }

  return statements;
}

/**
 * 詳細ページ HTML から PDF リンクを抽出する。
 */
export function parsePdfLinksFromDetail(
  html: string,
  detailPageUrl: string,
): string[] {
  const urls: string[] = [];
  const aPattern = /<a\s[^>]*href=["']([^"']+\.pdf)["'][^>]*>/gi;

  for (const m of html.matchAll(aPattern)) {
    const href = m[1]!.trim();
    if (!href) continue;
    const url = resolveUrl(href, detailPageUrl);
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * PDF URL からテキストを抽出し、開催日と発言一覧を返す。
 */
async function extractPdfContent(
  pdfUrl: string,
): Promise<{ text: string; heldOn: string | null } | null> {
  const buffer = await fetchBinary(pdfUrl);
  if (!buffer) return null;

  let pdfText: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    pdfText = text;
  } catch (e) {
    console.warn(
      `extractPdfContent: PDF parse failed for ${pdfUrl}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }

  if (!pdfText || pdfText.trim().length === 0) return null;

  // 開催日をテキスト内から検出、失敗したらファイル名から推定
  let heldOn = parseDateString(pdfText);
  if (!heldOn) {
    heldOn = parsePdfFilenameDate(pdfUrl);
  }

  return { text: pdfText, heldOn };
}

/**
 * HTML 詳細ページから PDF リンクを収集し、MeetingData を生成する。
 */
export async function fetchHtmlDetailMeetingData(
  detailUrl: string,
  title: string,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(detailUrl);
  if (!html) return null;

  const pdfUrls = parsePdfLinksFromDetail(html, detailUrl);
  if (pdfUrls.length === 0) return null;

  // 開催日を詳細ページ HTML から先に試みる
  let heldOn: string | null = parseDateString(html.replace(/<[^>]+>/g, " "));

  // 複数 PDF を結合して全発言を収集する
  const allStatements: ParsedStatement[] = [];
  let globalOffset = 0;

  for (const pdfUrl of pdfUrls) {
    const result = await extractPdfContent(pdfUrl);
    if (!result) continue;

    if (!heldOn) {
      heldOn = result.heldOn;
    }

    const pageStatements = parsePdfStatements(result.text);

    for (const stmt of pageStatements) {
      allStatements.push({
        ...stmt,
        startOffset: globalOffset + stmt.startOffset,
        endOffset: globalOffset + stmt.endOffset,
      });
    }

    if (pageStatements.length > 0) {
      const last = pageStatements[pageStatements.length - 1]!;
      globalOffset += last.endOffset + 1;
    }
  }

  const statements = allStatements.length === 0 ? null : allStatements;

  // heldOn が取れなければ null を返す
  if (!heldOn) return null;

  const pdfId =
    pdfUrls[0]?.split("/").pop()?.replace(/\.pdf$/i, "") ?? "unknown";

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: detailUrl,
    externalId: `moseushi_${pdfId}`,
    statements: statements ?? [],
  };
}

/**
 * PDF を直接指定して MeetingData を生成する（一覧ページから直接 PDF リンクの場合）。
 */
export async function fetchDirectPdfMeetingData(
  pdfUrl: string,
  title: string,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const result = await extractPdfContent(pdfUrl);
  if (!result) return null;

  const heldOn = result.heldOn;
  if (!heldOn) return null;

  const statements = parsePdfStatements(result.text);
  // statements が空でも null にしない（heldOn がある場合は MeetingData を返す）
  const statementsOrNull = statements.length === 0 ? null : statements;

  const pdfId = pdfUrl.split("/").pop()?.replace(/\.pdf$/i, "") ?? "unknown";

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: pdfUrl,
    externalId: `moseushi_${pdfId}`,
    statements: statementsOrNull ?? [],
  };
}

/**
 * 会議録（HTML 詳細ページ または 直接 PDF）から MeetingData を取得する。
 */
export async function fetchMeetingData(
  params: {
    url: string;
    format: "html" | "pdf";
    title: string;
  },
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (params.format === "html") {
    return fetchHtmlDetailMeetingData(params.url, params.title, municipalityCode);
  }
  return fetchDirectPdfMeetingData(params.url, params.title, municipalityCode);
}
