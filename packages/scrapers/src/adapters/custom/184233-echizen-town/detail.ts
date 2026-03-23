/**
 * 越前町議会 — detail フェーズ
 *
 * 詳細ページから PDF リンクを収集し、PDF テキストを抽出して
 * MeetingData を組み立てる。
 *
 * 本会議議事録: ページ内の全 PDF をダウンロードしてテキスト結合
 * 一般質問会議録: テーブルから議員ごとの PDF を収集
 *
 * 発言フォーマット:
 *   ○議長（山川知一郎君）　ただいまから会議を開きます。
 *   ○町長（内藤俊三君）　お答えいたします。
 *   ○５番（吉田太郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { delay, fetchBinary, fetchPage, resolveUrl } from "./shared";

export interface EchizenDetailParams {
  title: string;
  detailUrl: string;
  pagePath: string;
  pageId: string;
  meetingType: string;
  generalQuestion: boolean;
  heldOn: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "支配人",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "支配人",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山川知一郎君）　→ role=議長, name=山川知一郎
 *   ○町長（内藤俊三君）　  → role=町長, name=内藤俊三
 *   ○５番（吉田太郎君）　  → role=議員, name=吉田太郎
 *   ○総務部長（佐藤次郎君）→ role=部長, name=佐藤次郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（吉田太郎君）
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

  // ○ マーカーはあるがカッコパターンに合致しない場合
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
export function classifyKind(speakerRole: string | null): string {
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
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
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
 * 詳細ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parsePdfLinks(
  html: string,
): { pdfUrl: string; linkText: string }[] {
  const results: { pdfUrl: string; linkText: string }[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]*>/g, "").trim();

    const pdfUrl = resolveUrl(href);

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({ pdfUrl, linkText });
  }

  return results;
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
      `[184233-echizen-town] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 *
 * 本会議議事録の場合:
 *   詳細ページ内の全 PDF を取得・テキスト結合し、1つの MeetingData として返す。
 *
 * 一般質問会議録の場合:
 *   各議員ごとの PDF を取得し、全 PDF のテキストを結合して返す。
 */
export async function buildMeetingData(
  params: EchizenDetailParams,
  municipalityId: string,
): Promise<MeetingData> {
  const externalId = `echizen_${params.pageId}`;

  // 詳細ページを取得して PDF リンクを収集
  const html = await fetchPage(params.detailUrl);
  if (!html) {
    return {
      municipalityId,
      title: params.title,
      meetingType: params.meetingType,
      heldOn: params.heldOn,
      sourceUrl: params.detailUrl,
      externalId,
      statements: [],
    };
  }

  const pdfLinks = parsePdfLinks(html);

  // 全 PDF のテキストを取得して結合
  const allStatements: ParsedStatement[] = [];
  for (let i = 0; i < pdfLinks.length; i++) {
    const text = await fetchPdfText(pdfLinks[i]!.pdfUrl);
    if (text) {
      const stmts = parseStatements(text);
      allStatements.push(...stmts);
    }
    if (i < pdfLinks.length - 1) {
      await delay(1000);
    }
  }

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.detailUrl,
    externalId,
    statements: allStatements,
  };
}
