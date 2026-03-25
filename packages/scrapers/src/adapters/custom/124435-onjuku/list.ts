/**
 * 御宿町議会 -- list フェーズ
 *
 * 年度別一覧ページから PDF リンクを収集する。
 * 構造: 年度ページ (h3 で定例会/臨時会に区分) → PDF リンク
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  detectMeetingType,
  fetchPage,
} from "./shared";

export interface OnjukuPdfRecord {
  /** 会議タイトル（例: "令和６年第３回定例会会議録"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年度ページの URL */
  yearPageUrl: string;
}

/**
 * 目次 PDF かどうかを判定する。
 * mokuji や c.pdf パターンは目次ファイルとして除外する。
 */
export function isTocPdf(href: string, linkText: string): boolean {
  const lower = href.toLowerCase();
  if (lower.includes("mokuji")) return true;
  // 旧フォーマット: re3c.pdf など末尾 c.pdf パターン
  if (/re\d+c\.pdf$/i.test(lower)) return true;
  // リンクテキストに「目次」が含まれる
  if (linkText.includes("目次")) return true;
  return false;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 * href が .pdf で終わるリンクを全て取得し、目次 PDF は除外する。
 */
export function parseYearPage(html: string, yearPageUrl: string): OnjukuPdfRecord[] {
  const records: OnjukuPdfRecord[] = [];
  const seen = new Set<string>();

  // h3 を区切りに会議種別を追跡しながら PDF リンクを収集
  // h3 内のテキストから定例会/臨時会を判別
  let currentSection = "";
  const sectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const linkPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // セクション位置と PDF リンク位置を合わせて処理するためにインデックスを管理
  const allMatches: Array<{ pos: number; type: "section" | "link"; text: string; href?: string }> = [];

  let m: RegExpExecArray | null;

  while ((m = sectionPattern.exec(html)) !== null) {
    const text = m[1]!.replace(/<[^>]+>/g, "").trim();
    allMatches.push({ pos: m.index, type: "section", text });
  }

  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!;
    const text = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    allMatches.push({ pos: m.index, type: "link", text, href });
  }

  // 位置順にソート
  allMatches.sort((a, b) => a.pos - b.pos);

  for (const item of allMatches) {
    if (item.type === "section") {
      currentSection = item.text;
      continue;
    }

    const href = item.href!;
    const linkText = item.text;

    if (!linkText) continue;
    if (isTocPdf(href, linkText)) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    // タイトルをリンクテキストから構築（セクション情報を補完）
    const title = linkText
      .replace(/[（(]\s*PDF[：:][^）)]*[）)]/gi, "")
      .replace(/\s*\[PDF\]/gi, "")
      .trim();

    if (!title) continue;

    // 会議種別: リンクテキストまたはセクション見出しから判別
    const meetingType = detectMeetingType(title) !== "plenary"
      ? detectMeetingType(title)
      : detectMeetingType(currentSection);

    records.push({
      title,
      pdfUrl,
      meetingType,
      yearPageUrl,
    });
  }

  return records;
}

/**
 * 指定年度の PDF レコード一覧を取得する。
 */
export async function fetchPdfList(year: number): Promise<OnjukuPdfRecord[]> {
  const yearPageUrl = buildYearPageUrl(year);
  if (!yearPageUrl) {
    console.warn(`[124435-onjuku] 年度 ${year} の URL が未登録`);
    return [];
  }

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html, yearPageUrl);
}
