/**
 * 北川村議会 — detail フェーズ
 *
 * 詳細ページから PDF リンクを取得し、PDF をダウンロードしてテキストを抽出する。
 * ○ マーカーで発言を分割して ParsedStatement 配列を生成する。
 *
 * PDF リンク構造:
 * - div.file_link > p.icon-pdf > a: PDF リンク
 * - href: /download/?t=LD&id={ページID}&fid={ファイルID}
 *
 * 発言フォーマット（PDF テキスト）:
 *   ○ 議長（山田太郎君） 　ただいまから会議を開きます。
 *   ○ 村長（鈴木一郎君） 　お答えします。
 *   ○ 1番（田中花子君） 　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KitagawaArticle } from "./list";
import { BASE_ORIGIN, detectMeetingType, fetchBinary, fetchPage } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
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
  "課長補佐",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "教育次長",
]);

// 進行役の役職
const REMARK_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
]);

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "副町長",
  "副市長",
  "村長",
  "町長",
  "市長",
  "副教育長",
  "教育長",
  "教育次長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "課長補佐",
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

/**
 * ○ マーカー付きの発言テキストから話者情報を抽出する。
 *
 * 北川村の PDF テキストは主にカッコ形式:
 *   ○ 議長（山田太郎君） 発言内容
 *   ○ 村長（鈴木一郎君） 発言内容
 *   ○ 1番（田中花子君） 発言内容
 *
 * スペース区切り形式にも対応:
 *   ○ 山田 議長 発言内容
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: カッコ形式 — role（name + 君|様|議員）content
  const parenMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (parenMatch) {
    const rolePart = parenMatch[1]!.trim();
    const rawName = parenMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = parenMatch[3]!.trim();

    // 番号議員パターン: "1番" → 議員
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  // パターン2: スペース区切り形式
  const tokens = stripped.split(/\s+/);
  if (tokens.length >= 3) {
    for (let i = 1; i <= Math.min(3, tokens.length - 2); i++) {
      const rolePart = tokens[i]!;
      const role = matchRole(rolePart);
      if (role) {
        const name = tokens.slice(0, i).join("");
        const content = tokens.slice(i + 1).join(" ").trim();
        return { speakerName: name, speakerRole: role, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/**
 * 役職文字列からロールサフィックスをマッチさせる。
 * 長いパターンを先にチェックして誤マッチを防ぐ。
 */
function matchRole(rolePart: string): string | null {
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 北川村の PDF は発言マーカー（○）のない審議結果サマリーのため、
 * ○ マーカーがある場合は発言ごとに分割し、
 * ○ マーカーがない場合は全テキストを単一の remark として扱う。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  // ○ マーカーがある場合：発言ごとに分割
  if (/[○◯◎●]/.test(normalized)) {
    const blocks = normalized.split(/(?=[○◯◎●])/);
    const statements: ParsedStatement[] = [];
    let offset = 0;

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

      // 出席表などの短いマーカーをスキップ
      const afterMarker = trimmed.replace(/^[○◯◎●]\s*/, "").trim();
      if (afterMarker.length < 5) continue;

      // ト書き（登壇等）をスキップ
      if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
        continue;

      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
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

  // ○ マーカーなし（審議結果サマリー等）：全テキストを単一の remark として扱う
  const contentHash = createHash("sha256").update(normalized).digest("hex");
  return [
    {
      kind: "remark",
      speakerName: null,
      speakerRole: null,
      content: normalized,
      contentHash,
      startOffset: 0,
      endOffset: normalized.length,
    },
  ];
}

export interface KitagawaPdfLink {
  pdfUrl: string;
  label: string;
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する。
 *
 * セレクタ: div.file_link > p.icon-pdf > a
 * href: /download/?t=LD&id={ページID}&fid={ファイルID}
 */
export function parseDetailPage(html: string): KitagawaPdfLink[] {
  const results: KitagawaPdfLink[] = [];

  // div.file_link 内の p.icon-pdf > a を抽出
  const fileLinkPattern =
    /<div[^>]*class="file_link"[^>]*>([\s\S]*?)<\/div>/gi;

  for (const divMatch of html.matchAll(fileLinkPattern)) {
    const divContent = divMatch[1]!;

    // p.icon-pdf 内の a タグを抽出
    const pdfLinkPattern =
      /<p[^>]*class="icon-pdf"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of divContent.matchAll(pdfLinkPattern)) {
      const href = linkMatch[1]!;
      const labelHtml = linkMatch[2]!;
      const label = labelHtml
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();

      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      results.push({ pdfUrl, label });
    }
  }

  return results;
}

/**
 * タイトルから開催日 (YYYY-MM-DD) を抽出する。
 *
 * 例:
 *   "令和7年第4回定例会 会期日程・審議結果" → null（日付なし）
 *   "令和6年第4回定例会(令和6年12月17日～18日)" → "2024-12-17"
 */
export function parseTitleDate(title: string): string | null {
  const eraMatch = title.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!eraMatch) return null;

  const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * タイトルから年度情報（令和・平成 → 西暦年）を抽出する。
 *
 * 例: "令和7年第4回定例会" → 2025
 */
export function parseYearFromTitle(title: string): number | null {
  const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;

  const [, era, eraYearStr] = eraMatch;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * PDF をダウンロードしてテキストを抽出する。
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
      `[393053-kitagawa] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 記事情報から MeetingData を組み立てる。
 *
 * 1記事に複数の PDF リンクがある場合は、最初の PDF のみを対象とする。
 */
export async function fetchMeetingData(
  article: KitagawaArticle,
  municipalityCode: string,
  targetYear: number
): Promise<MeetingData | null> {
  // 対象年と一致しない記事はスキップ
  const titleYear = parseYearFromTitle(article.title);
  if (titleYear !== null && titleYear !== targetYear) return null;

  // 「会期及び審議の予定」は予定のみで審議結果なし → スキップ
  if (article.title.includes("会期及び審議の予定") || article.title.includes("審議の予定")) {
    return null;
  }

  const html = await fetchPage(article.detailUrl);
  if (!html) return null;

  const pdfLinks = parseDetailPage(html);
  if (pdfLinks.length === 0) return null;

  // 最初の PDF を処理する
  const pdfLink = pdfLinks[0]!;

  const text = await fetchPdfText(pdfLink.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // 開催日を取得（タイトルから日付を抽出できる場合のみ）
  const heldOn = parseTitleDate(pdfLink.label) ?? parseTitleDate(article.title);
  if (!heldOn) return null;

  // externalId: hdnKey + fid
  const fidMatch = pdfLink.pdfUrl.match(/fid=(\d+)/);
  const externalId = fidMatch
    ? `kitagawa_${article.hdnKey}_${fidMatch[1]}`
    : `kitagawa_${article.hdnKey}`;

  return {
    municipalityCode,
    title: article.title,
    meetingType: detectMeetingType(article.title),
    heldOn,
    sourceUrl: article.detailUrl,
    externalId,
    statements,
  };
}
