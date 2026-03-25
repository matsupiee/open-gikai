/**
 * 小川村議会 -- list フェーズ
 *
 * 会議録一覧ページ (64436.html) から全 PDF リンクを収集する。
 *
 * ページは単一ページで全件掲載（ページネーションなし）。
 * h2 見出しが月別セクション（3月 / 6月 / 9月 / 12月 / 臨時会）を示し、
 * h3 見出しが会議種別（説明 / 一般質問 / 質疑 / 討論採決 / 発議・議会構成）を示す。
 * PDF リンクは a タグで href が /fs/ を含み .pdf で終わる。
 *
 * 掲載は現年度分のみ（過去年度は別ページに存在するかは不明）。
 * ページ上に年度は明示されないため、PDF ファイル名から和暦年を取得して西暦に変換する。
 *
 * ファイル名命名規則: {和暦年}.{月}.{日}{会議種別}.pdf
 * - 和暦年: "7" = 令和7年、"R7" or "R8" = 令和7年/8年（表記ゆれあり）
 */

import { detectMeetingType, fetchPage, toHalfWidth } from "./shared";

export const LIST_URL = "https://www.vill.ogawa.nagano.jp/docs/64436.html";

export interface OgawaNaganoPdfLink {
  /** 会議タイトル（例: "令和7年6月定例会 一般質問"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年の見出し（月名 or "臨時会"） */
  monthSection: string;
  /** 会議種別セクション（h3 見出し） */
  typeSection: string;
}

/**
 * 相対 URL を絶対 URL に変換する。
 * "/fs/..." → "https://www.vill.ogawa.nagano.jp/fs/..."
 */
export function resolveUrl(href: string, baseOrigin: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${baseOrigin}${href}`;
  return href;
}

/**
 * PDF ファイル名から西暦年を抽出する。
 *
 * ファイル名パターン例:
 * - "7.6.05開会議案説明.pdf" → 令和7年 → 2025
 * - "R7.6.06一般質問.pdf" → 令和7年 → 2025
 * - "R8.1.13臨時議会.pdf" → 令和8年 → 2026
 * - "7.12.4議案説明.pdf" → 令和7年 → 2025
 */
export function extractYearFromFilename(filename: string): number | null {
  const normalized = toHalfWidth(filename);
  // R7.*, R8.* パターン
  const rMatch = normalized.match(/^R(\d+)\./);
  if (rMatch) {
    return 2018 + Number(rMatch[1]);
  }
  // 7.*.*, 8.*.* パターン（先頭の数字が和暦年）
  const plainMatch = normalized.match(/^(\d+)\.\d/);
  if (plainMatch) {
    return 2018 + Number(plainMatch[1]);
  }
  return null;
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * h2 見出しから月別セクションを取得し、
 * h3 見出しから会議種別を取得した後、
 * a[href] で PDF リンクを収集する。
 */
export function parseListPage(html: string, baseOrigin: string): OgawaNaganoPdfLink[] {
  const results: OgawaNaganoPdfLink[] = [];

  // h2, h3, a タグをトークンとして順に処理する
  const tokenPattern = /<(h2|h3)[^>]*>([\s\S]*?)<\/\1>|<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentMonth = "";
  let currentType = "";

  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(html)) !== null) {
    const tag = m[1]; // "h2" or "h3" or undefined
    if (tag === "h2") {
      const text = m[2]!.replace(/<[^>]+>/g, "").trim();
      currentMonth = text;
      currentType = "";
    } else if (tag === "h3") {
      const text = m[2]!.replace(/<[^>]+>/g, "").trim();
      currentType = text;
    } else {
      // a タグ
      const href = m[3]!;
      const linkText = m[4]!.replace(/<[^>]+>/g, "").trim();

      // /fs/ を含み .pdf で終わるリンクのみ
      if (!href.includes("/fs/") || !href.toLowerCase().endsWith(".pdf")) continue;
      if (!currentMonth) continue;

      const pdfUrl = resolveUrl(href, baseOrigin);
      // ファイル名を取得（URLデコード済みの末尾部分）
      const rawFilename = href.split("/").pop() ?? "";
      const filename = decodeURIComponent(rawFilename);

      const year = extractYearFromFilename(filename);
      const yearLabel = year ? `令和${year - 2018}年` : "";

      // 臨時会かどうかで会議種別を判定
      const titleSection = currentMonth === "臨時会" ? "臨時会" : `${currentMonth}定例会`;
      const title = yearLabel
        ? `${yearLabel}${titleSection}${currentType ? ` ${currentType}` : ""}`
        : `${titleSection}${currentType ? ` ${currentType}` : ""}`;

      const meetingType = detectMeetingType(title + " " + linkText);

      results.push({
        title,
        pdfUrl,
        meetingType,
        monthSection: currentMonth,
        typeSection: currentType,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * 単一ページから全リンクを取得し、ファイル名から年を判定してフィルタリングする。
 */
export async function fetchDocumentList(
  baseUrl: string,
  year: number,
  baseOrigin: string,
): Promise<OgawaNaganoPdfLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const allLinks = parseListPage(html, baseOrigin);

  // 年フィルタリング: pdfUrl のファイル名から年を抽出
  return allLinks.filter((link) => {
    const rawFilename = link.pdfUrl.split("/").pop() ?? "";
    const filename = decodeURIComponent(rawFilename);
    const extractedYear = extractYearFromFilename(filename);
    // 年が抽出できない場合もそのまま含める（安全のため）
    return extractedYear === null || extractedYear === year;
  });
}
