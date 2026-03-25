/**
 * 須崎市議会 — detail フェーズ
 *
 * 詳細ページ（giji_dtl.php）から会議メタ情報と PDF リンクを取得し、
 * PDF をダウンロードしてテキストを抽出、発言を分割して MeetingData を生成する。
 *
 * 詳細ページ構造:
 *   <h2>第490回9月定例会</h2>
 *   <!-- パンくずに開催日: (開催日:2025/09/03) -->
 *   <a href="../data/fd_19ejh8s2b9203k/downfile9548642254.pdf">
 *     第490回9月定例会（152KB）
 *   </a>
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { SusakiListItem } from "./list";
import { BASE_ORIGIN, fetchPage, fetchBinary, detectMeetingType } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "町長",
  "副町長",
  "村長",
  "副村長",
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

// 役職サフィックス（長いものを先に並べて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副市長",
  "副村長",
  "町長",
  "市長",
  "村長",
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
 * 役職文字列からロールサフィックスをマッチさせる。
 */
function matchRole(rolePart: string): string | null {
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

/** 全角数字を半角数字に変換する */
function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}

/**
 * 詳細ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parsePdfLinks(
  html: string,
  baseUrl: string
): { url: string; label: string }[] {
  const results: { url: string; label: string }[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const innerHtml = match[2]!;

    const label = innerHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/[\s　]+/g, " ")
      .trim();

    // 絶対 URL に変換
    let absUrl: string;
    if (href.startsWith("http")) {
      absUrl = href;
    } else if (href.startsWith("/")) {
      absUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // ../data/xxx/downfileyyy.pdf を絶対 URL に変換
      // baseUrl = https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?...
      const base = new URL(baseUrl);
      absUrl = new URL(href, base).href;
    }

    if (seen.has(absUrl)) continue;
    seen.add(absUrl);

    results.push({ url: absUrl, label });
  }

  return results;
}

/**
 * 詳細ページの HTML から会議名を抽出する（テスト可能な純粋関数）。
 *
 * h2 タグのテキストを取得する。
 */
export function parseMeetingTitle(html: string): string | null {
  const match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!match) return null;

  return match[1]!
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\s　]+/g, " ")
    .trim() || null;
}

/**
 * 詳細ページの HTML から開催日（YYYY-MM-DD）を抽出する（テスト可能な純粋関数）。
 *
 * パンくずに `(開催日:2025/12/03)` 形式で含まれる。
 */
export function parseHeldOn(html: string): string | null {
  const match = html.match(/開催日:(\d{4})\/(\d{2})\/(\d{2})/);
  if (!match) return null;

  return `${match[1]}-${match[2]}-${match[3]}`;
}

/**
 * 発言行かどうかを判定する。
 *
 * 須崎市の PDF は「○役職（氏名君）」形式（○プレフィックスあり）。
 * 1文字スペース区切り形式「役職（ 氏名 君 ）」にも対応。
 */
function isSpeakerLine(line: string): boolean {
  const normalized = line.replace(/　/g, " ").trim();
  // ○ プレフィックスのある形式（須崎市標準）
  if (/^○.+?[（(].+?(?:君|様)[）)]/.test(normalized)) return true;
  // 1文字スペース区切り形式
  if (/^.+?[（(].+?(?:君|様|議員)\s*[）)]/.test(normalized)) return true;
  return false;
}

/**
 * 発言行から話者情報を抽出する（テスト可能な純粋関数）。
 *
 * 対応形式:
 *   ○議長（土居信一君） 発言内容...       （須崎市標準形式）
 *   ○2番（鈴木一郎君） 発言内容...        （番号議員）
 *   議 長（ 松 浦 隆 起 君 ） お は よ う  （1文字スペース区切り形式）
 */
export function parseSpeaker(line: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const normalized = line.replace(/　/g, " ").trim();

  // ○ プレフィックスを除去してから解析
  const stripped = normalized.startsWith("○") ? normalized.slice(1) : normalized;

  const parenMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)\s*[）)]\s*([\s\S]*)/
  );
  if (parenMatch) {
    const rolePart = parenMatch[1]!.replace(/\s/g, "").trim();
    const rawName = parenMatch[2]!.replace(/\s/g, "").trim();
    const rawContent = parenMatch[3]!.trim();
    const content = normalizeSpacedText(rawContent);

    const digitNorm = normalizeDigits(rolePart);
    if (/^\d+番$/.test(digitNorm)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  return { speakerName: null, speakerRole: null, content: normalized };
}

/**
 * 1文字ずつスペースで区切られたテキストを通常の文章に正規化する。
 */
function normalizeSpacedText(text: string): string {
  let normalized = text.replace(/　/g, " ");

  for (let i = 0; i < 5; i++) {
    normalized = normalized.replace(
      /([\u3000-\u9fff\uff00-\uffef。、！？「」『』（）・]) ([\u3000-\u9fff\uff00-\uffef。、！？「」『』（）・])/g,
      "$1$2"
    );
  }

  return normalized.trim();
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
 * PDF テキストから発言を解析して ParsedStatement 配列を生成する（テスト可能な純粋関数）。
 *
 * 須崎市の PDF は「○役職（氏名君）発言内容」形式で、
 * ○ 記号を区切りとして発言ブロックを識別する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  if (!text) return [];
  const normalized = normalizeDigits(text);

  // ○ 記号で分割してブロックを生成（○ で始まるパターンを優先）
  // テキスト全体で ○役職（氏名君） パターンが存在するかを確認
  const hasCirclePrefix = /○.+?[（(].+?(?:君|様)[）)]/.test(normalized);

  const blocks: string[] = [];

  if (hasCirclePrefix) {
    // ○ プレフィックス形式: テキスト全体を ○ で分割
    // 改行有無にかかわらず、○ 記号を発言区切りとして扱う
    const fullText = normalized.replace(/\n/g, " ");
    // ○ の前で分割（ただし最初の ○ 以前のテキストは捨てる）
    const parts = fullText.split(/(?=○[^○])/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || !trimmed.startsWith("○")) continue;
      if (isSpeakerLine(trimmed)) {
        blocks.push(trimmed);
      }
    }
  } else {
    // 1文字スペース区切り形式（フォールバック）
    const lines = normalized.split(/\n/);
    let current = "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (isSpeakerLine(trimmed)) {
        if (current) {
          blocks.push(current.trim());
        }
        current = trimmed;
      } else {
        if (current) {
          current += " " + trimmed;
        }
      }
    }
    if (current) {
      blocks.push(current.trim());
    }
  }

  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const { speakerName, speakerRole, content } = parseSpeaker(block);
    if (!content || content.length < 3) continue;

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
 * PDF URL からテキストを抽出する。
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
      `[392065-susaki] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * SusakiListItem から externalId を生成する。
 * e.g., category=3000, hdnId=489, pdfIndex=0 → "susaki_3000_489_0"
 */
function buildExternalId(item: SusakiListItem, pdfIndex: number): string {
  return `susaki_${item.category}_${item.hdnId}_${pdfIndex}`;
}

/**
 * 詳細ページにアクセスして PDF リンクを取得し、各 PDF から MeetingData を生成する。
 * 1 つの hdnID に複数の PDF（委員会ごと）が含まれる場合があるため、
 * PDF ごとに MeetingData を返す。
 */
export async function fetchMeetingData(
  item: SusakiListItem,
  municipalityCode: string
): Promise<MeetingData | null> {
  const html = await fetchPage(item.detailUrl);
  if (!html) return null;

  const title = parseMeetingTitle(html) ?? item.meetingName;
  const heldOn = parseHeldOn(html);
  if (!heldOn) return null;

  const pdfLinks = parsePdfLinks(html, item.detailUrl);
  if (pdfLinks.length === 0) return null;

  // 最初の PDF を使用（1 hdnID につき 1 MeetingData として返す）
  // 委員会の複数 PDF は index.ts の fetchDetail 側でループ処理
  const pdfLink = pdfLinks[0]!;
  const text = await fetchPdfText(pdfLink.url);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const externalId = buildExternalId(item, 0);
  const meetingType = detectMeetingType(title);

  return {
    municipalityCode,
    title,
    meetingType,
    heldOn,
    sourceUrl: pdfLink.url,
    externalId,
    statements,
  };
}

/**
 * 詳細ページにアクセスして全 PDF リンクを取得し、各 PDF に対応する MeetingData を返す。
 * 委員会会議録は複数 PDF（委員会ごと）を持つため、配列で返す。
 */
export async function fetchAllMeetingData(
  item: SusakiListItem,
  municipalityCode: string
): Promise<MeetingData[]> {
  const html = await fetchPage(item.detailUrl);
  if (!html) return [];

  const baseTitle = parseMeetingTitle(html) ?? item.meetingName;
  const heldOn = parseHeldOn(html);
  if (!heldOn) return [];

  const pdfLinks = parsePdfLinks(html, item.detailUrl);
  if (pdfLinks.length === 0) return [];

  const results: MeetingData[] = [];

  for (let i = 0; i < pdfLinks.length; i++) {
    const pdfLink = pdfLinks[i]!;
    const text = await fetchPdfText(pdfLink.url);
    if (!text) continue;

    const statements = parseStatements(text);
    if (statements.length === 0) continue;

    // PDF ラベルが委員会名を含む場合はタイトルに付加
    const title = pdfLink.label && pdfLink.label !== baseTitle
      ? `${baseTitle} ${pdfLink.label}`.trim()
      : baseTitle;

    const externalId = buildExternalId(item, i);
    const meetingType = detectMeetingType(title);

    results.push({
      municipalityCode,
      title,
      meetingType,
      heldOn,
      sourceUrl: pdfLink.url,
      externalId,
      statements,
    });
  }

  return results;
}
