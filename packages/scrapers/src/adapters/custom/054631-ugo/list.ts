/**
 * 羽後町議会 — list フェーズ
 *
 * 2段階クロール:
 * 1. 最新年ページ（id=1247）と過去分目次ページ（id=2314）から年度別ページの URL を収集
 * 2. 各年度別ページから PDF リンクを収集
 *
 * 各 PDF ファイルごとに1レコードを返す。
 */

import {
  TOP_URL,
  ARCHIVE_URL,
  detectMeetingType,
  parseWarekiYear,
  toHalfWidth,
  fetchPage,
  resolveUrl,
  delay,
} from "./shared";

export interface UgoSessionInfo {
  /** 会議タイトル（例: "令和７年１２月定例会 第１日"） */
  title: string;
  /** 開催日 YYYY-MM-DD。解析できない場合は null */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 年度ページの URL（externalId 用） */
  yearPageUrl: string;
  /** PDF リンクテキスト（例: "第１日"） */
  pdfLabel: string;
  /** h2 見出しテキスト（会議名称、例: "令和７年１２月臨時会"） */
  meetingName: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全セッション PDF を収集する。
 * baseUrl（= 会議録トップページ URL）から年度ページ → PDF リンクを辿る。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<UgoSessionInfo[]> {
  // Step 1: 最新ページと過去分目次ページから年度ページ URL を収集
  const yearPageUrls = await collectYearPageUrls(year);
  if (yearPageUrls.length === 0) return [];

  const allSessions: UgoSessionInfo[] = [];

  for (const yearPageUrl of yearPageUrls) {
    await delay(INTER_PAGE_DELAY_MS);

    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const sessions = extractPdfRecords(yearHtml, yearPageUrl, year);
    allSessions.push(...sessions);
  }

  return allSessions;
}

/**
 * 最新年ページと過去分目次ページから、指定年に対応する年度ページ URL を収集する。
 */
async function collectYearPageUrls(year: number): Promise<string[]> {
  const urls: string[] = [];

  // 最新年ページ（id=1247）をまず確認
  const topHtml = await fetchPage(TOP_URL);
  if (topHtml) {
    const topYear = extractYearFromPage(topHtml);
    if (topYear === year) {
      urls.push(TOP_URL);
    }
  }

  await delay(INTER_PAGE_DELAY_MS);

  // 過去分目次ページからリンクを収集
  const archiveHtml = await fetchPage(ARCHIVE_URL);
  if (archiveHtml) {
    const archiveUrls = parseYearPageUrlsFromArchive(archiveHtml, year);
    for (const url of archiveUrls) {
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * ページの h2 タグから年度を推定する。
 * 例: "令和７年１２月定例会" → 2025
 */
export function extractYearFromPage(html: string): number | null {
  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (!h2Match) return null;
  return parseWarekiYear(h2Match[1]!);
}

/**
 * 過去分目次ページ HTML から、指定年に該当する年度ページ URL を抽出する。
 */
export function parseYearPageUrlsFromArchive(html: string, year: number): string[] {
  const urls: string[] = [];

  // administration/detail.html?id=XXXX&category_id=XX 形式のリンク
  const pattern =
    /<a\s[^>]*href="((?:https?:\/\/[^"]*)?\/administration\/detail\.html\?[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.trim();

    const pageYear = parseWarekiYear(linkText);
    if (pageYear === year) {
      const url = resolveUrl(href);
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * 年度ページ HTML から PDF レコードを抽出する。
 *
 * h2 タグで会議名を取得し、直後のセクション内の PDF リンクを収集する。
 */
export function extractPdfRecords(
  html: string,
  yearPageUrl: string,
  year: number
): UgoSessionInfo[] {
  const records: UgoSessionInfo[] = [];

  // h2 タグと PDF リンクの対応を取得するため、HTML を順次処理
  // h2 セクションを分割してパース
  const sections = splitIntoH2Sections(html);

  for (const section of sections) {
    const meetingName = section.heading;
    const meetingType = detectMeetingType(meetingName);

    // PDF リンクを抽出（.pdf で終わる href）
    const pdfPattern = /<a\s[^>]*href="([^"]+\.pdf[^"]*)"[^>]*>([^<]+)<\/a>/gi;

    let m: RegExpExecArray | null;
    while ((m = pdfPattern.exec(section.content)) !== null) {
      const href = m[1]!;
      const pdfLabel = m[2]!.trim();
      const pdfUrl = resolveUrl(decodeURIComponent(href));

      const heldOn = inferHeldOn(meetingName, pdfLabel, year);

      const title = `${meetingName} ${pdfLabel}`;

      records.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
        yearPageUrl,
        pdfLabel,
        meetingName,
      });
    }
  }

  return records;
}

interface H2Section {
  heading: string;
  content: string;
}

/**
 * HTML を h2 タグで区切ってセクションに分割する。
 */
export function splitIntoH2Sections(html: string): H2Section[] {
  const sections: H2Section[] = [];

  // h2 タグの位置を全て取得
  const h2Pattern = /<h2[^>]*>([^<]+)<\/h2>/gi;
  const matches: Array<{ heading: string; index: number; endIndex: number }> = [];

  let m: RegExpExecArray | null;
  while ((m = h2Pattern.exec(html)) !== null) {
    matches.push({
      heading: m[1]!.trim(),
      index: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i]!;
    const nextIndex = i + 1 < matches.length ? matches[i + 1]!.index : html.length;
    const content = html.slice(current.endIndex, nextIndex);

    sections.push({
      heading: current.heading,
      content,
    });
  }

  return sections;
}

/**
 * 会議名と PDF ラベルから開催日を推定する。
 *
 * 会議名例: "令和７年１２月臨時会"
 * PDF ラベル例: "第１日", "第２日"
 *
 * h2 の月情報から年月を取得し、PDF ラベルの「第X日」は日付として使えないため、
 * 会議名の月から 1 日を仮の日付として返す（詳細な日付は PDF 本文に記載）。
 * 実際には月の情報のみで日付が特定できないため、月の最初の日を返す。
 */
export function inferHeldOn(
  meetingName: string,
  _pdfLabel: string,
  year: number
): string | null {
  const normalized = toHalfWidth(meetingName);

  // "XX月" を抽出
  const monthMatch = normalized.match(/(\d{1,2})月/);
  if (!monthMatch) return null;

  const month = parseInt(monthMatch[1]!, 10);
  if (month < 1 || month > 12) return null;

  return `${year}-${String(month).padStart(2, "0")}-01`;
}
