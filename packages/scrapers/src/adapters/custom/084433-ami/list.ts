/**
 * 阿見町議会 — list フェーズ
 *
 * インデックスページ (0000000309.html) から全 PDF リンクを収集する。
 * 年度ごとの見出し (h2) 配下に PDF リンクが列挙されている。
 * 1ページに全年度の PDF がまとまっているため、ページ遷移は不要。
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは各 PDF ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  PDF_DIR,
  detectMeetingType,
  parseDateRange,
  parseHeadingYear,
  fetchPage,
} from "./shared";

export interface AmiPdfInfo {
  /** 会議タイトル（例: "第1回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（会期初日） */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF ファイル名（externalId 生成用） */
  fileName: string;
}

/**
 * インデックスページから指定年の PDF 一覧を収集する。
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<AmiPdfInfo[]> {
  const indexUrl = `${BASE_ORIGIN}/0000000309.html`;
  const html = await fetchPage(indexUrl);
  if (!html) return [];

  return parseIndexPage(html, year);
}

// --- HTML パーサー（テスト用に export） ---

export interface PdfRecord {
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD（会期初日） */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** PDF ファイル名 */
  fileName: string;
}

/**
 * インデックスページ HTML をパースして、指定年に該当する PDF レコードを返す。
 *
 * HTML 構造:
 *   <h2>令和7年</h2>
 *   ...
 *   <a href="./cmsfiles/contents/0000000/309/R0703_T1.pdf">第1回定例会（2月25日～3月18日）(PDF形式、...)</a>
 *
 * 年の判定は h2 見出しの和暦テキストから行う。
 */
export function parseIndexPage(html: string, year: number): PdfRecord[] {
  const records: PdfRecord[] = [];

  // h2 で年セクションを分割
  // 各セクションの先頭から年を判定し、その中の PDF リンクを収集する
  const sections = splitByHeading(html);

  for (const section of sections) {
    const sectionYear = parseHeadingYear(section.heading);
    if (sectionYear === null || sectionYear !== year) continue;

    // セクション内の PDF リンクを抽出
    const pdfLinks = extractPdfLinks(section.content, sectionYear);
    records.push(...pdfLinks);
  }

  return records;
}

interface HeadingSection {
  heading: string;
  content: string;
}

/**
 * HTML を h3 見出しで分割する。
 * 阿見町のページでは年セクションが h3 で区切られている。
 */
export function splitByHeading(html: string): HeadingSection[] {
  const sections: HeadingSection[] = [];
  const h2Pattern = /<h3[^>]*>(.*?)<\/h3>/gi;

  const headings: { text: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = h2Pattern.exec(html)) !== null) {
    headings.push({
      text: m[1]!.replace(/<[^>]+>/g, "").trim(),
      index: m.index + m[0].length,
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i]!.index;
    const end = i + 1 < headings.length ? headings[i + 1]!.index : html.length;
    sections.push({
      heading: headings[i]!.text,
      content: html.slice(start, end),
    });
  }

  return sections;
}

/**
 * セクション内の PDF リンクを抽出する。
 */
export function extractPdfLinks(
  sectionHtml: string,
  sectionYear: number
): PdfRecord[] {
  const records: PdfRecord[] = [];

  // href に cmsfiles/contents/0000000/309/ を含む <a> タグを抽出
  const linkPattern =
    /<a\s[^>]*href="([^"]*cmsfiles\/contents\/0000000\/309\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(sectionHtml)) !== null) {
    const rawHref = m[1]!;
    const linkText = m[2]!.replace(/<[^>]+>/g, "").trim();

    // ファイル名を抽出
    const fileNameMatch = rawHref.match(/\/([^/]+\.pdf)$/i);
    if (!fileNameMatch) continue;
    const fileName = fileNameMatch[1]!;

    // リンクテキストからタイトルを抽出（PDF形式 以降を除去）
    const title = linkText
      .replace(/\s*[\(（]PDF形式.*$/i, "")
      .replace(/\s*[\(（]PDF.*$/i, "")
      .replace(/\s+/g, "")
      .trim();

    if (!title) continue;

    // 開催日を抽出
    const dateRange = parseDateRange(title);
    if (!dateRange) continue;

    const heldOn = `${sectionYear}-${String(dateRange.startMonth).padStart(2, "0")}-${String(dateRange.startDay).padStart(2, "0")}`;

    // 会議種別を検出
    const meetingType = detectMeetingType(title);

    // PDF URL を構築（相対パスを絶対パスに変換）
    const pdfUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}${PDF_DIR}${fileName}`;

    records.push({
      title,
      heldOn,
      pdfUrl,
      meetingType,
      fileName,
    });
  }

  return records;
}
