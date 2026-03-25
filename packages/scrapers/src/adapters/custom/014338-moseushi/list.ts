/**
 * 妹背牛町議会 — list フェーズ
 *
 * 一覧ページ https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/ をパースし、
 * 全会議録への URL・タイトルを収集する。
 *
 * 構造:
 *   - リンクは HTML 詳細ページ（.html）または直接 PDF（.pdf）の 2 パターン
 *   - リンクは相対 URL（例: 2025-1119-1419-34.html, files/7.9.pdf）
 *   - 単一ページにすべてのリンクが集約されており、ページネーションはない
 *
 * 会議録リンクのパターン（相対 URL）:
 *   - 新形式 HTML: {YYYY}-{MMDD}-{HHMM}-{ID}.html
 *   - 令和初期 HTML: r{N}-{M}-{D}.html / R{N}-{M}-{D}.html / r{N}-{M}-{D}-{D2}.html
 *   - 平成 HTML: h{N}-{回}_{日目}.html / {YYYY}-{MMDD}-{HHMM}-{ID}.html
 *   - PDF: files/{和暦年}.{月}.pdf または files/{和暦年}.{月}.{日}.pdf
 */

import {
  LIST_PAGE_URL,
  detectMeetingType,
  fetchPage,
  parsePdfFilenameDate,
  resolveUrl,
} from "./shared";

export interface MoseushiLink {
  /** 絶対 URL */
  url: string;
  /** リンクテキスト（会議名、例: "令和7年第3回定例会"） */
  title: string;
  /** "html" | "pdf" */
  format: "html" | "pdf";
  /** 会議種別 */
  meetingType: string;
}

/**
 * href が会議録リンクとして有効かを判定する。
 *
 * 有効なパターン:
 *   - *.html で、年・月・日を示すパターン（新形式・令和・平成）
 *   - files/*.pdf
 *
 * 除外:
 *   - index.html, sitemap など一覧ページ自体
 *   - ../、../../ で始まる別ディレクトリへのリンク
 *   - gijiroku 以外のパス（絶対 URL で gijiroku を含まないもの）
 */
function isMeetingLink(href: string): { format: "html" | "pdf" } | null {
  // 絶対 URL で gijiroku 配下を含む場合
  if (href.startsWith("http")) {
    if (!href.includes("/gijiroku/")) return null;
    if (href.endsWith(".pdf")) return { format: "pdf" };
    if (href.endsWith(".html") && !href.endsWith("index.html")) return { format: "html" };
    return null;
  }

  // 上位ディレクトリへの相対 URL は除外
  if (href.startsWith("../") || href.startsWith("../../")) return null;

  // PDF: files/ 配下
  if (/^files\/[^/]+\.pdf$/i.test(href)) return { format: "pdf" };

  // HTML: 会議録ページのパターン
  // 新形式: 2025-1119-1419-34.html
  if (/^\d{4}-\d{4}-\d{4}-\d+\.html$/i.test(href)) return { format: "html" };
  // 令和: r3-12-16.html / R3-9-9.html / r3-3-9-17.html
  if (/^[rR]\d+-\d+[-\d]*\.html$/i.test(href)) return { format: "html" };
  // 令和（R2 など）: r2-4-1.html
  if (/^[rR]\d+-\d+-\d+[-\d]*\.html$/i.test(href)) return { format: "html" };
  // 平成: h28-1_1.html / h29-1_4.html
  if (/^h\d+-\d+_\d+\.html$/i.test(href)) return { format: "html" };
  // 平成 2018-XXXX 形式
  if (/^201[5-9]-\d{4}-\d{4}-\d+\.html$/i.test(href)) return { format: "html" };

  return null;
}

/**
 * 一覧ページ HTML から会議録リンクをパースする（純粋関数）。
 */
export function parseListPage(html: string): MoseushiLink[] {
  const links: MoseushiLink[] = [];

  // <a> タグをすべて抽出
  const aPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const aMatch of html.matchAll(aPattern)) {
    const href = aMatch[1]!.trim();
    const rawText = aMatch[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !rawText) continue;

    const match = isMeetingLink(href);
    if (!match) continue;

    // タイトルが会議関連でなければスキップ
    if (
      !rawText.includes("定例会") &&
      !rawText.includes("臨時会") &&
      !rawText.includes("委員会") &&
      !rawText.includes("議会")
    ) {
      continue;
    }

    const url = resolveUrl(href, LIST_PAGE_URL);

    links.push({
      url,
      title: rawText,
      format: match.format,
      meetingType: detectMeetingType(rawText),
    });
  }

  return links;
}

/**
 * タイトル文字列から西暦年を抽出する。
 * 例: "令和7年第3回定例会" → 2025
 */
export function extractYearFromTitle(title: string): number | null {
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const m = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!m) return null;
  const n = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  if (m[1] === "令和") return 2018 + n;
  if (m[1] === "平成") return 1988 + n;
  return null;
}

/**
 * 指定年の会議録リンク一覧を取得する。
 */
export async function fetchDocumentList(year: number): Promise<MoseushiLink[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allLinks = parseListPage(html);

  return allLinks.filter((link) => {
    const linkYear = extractYearFromTitle(link.title);
    if (linkYear === null) return false;
    // 指定年と前後1年を含める（3月会議は前年度として掲載されることがある）
    return linkYear === year || linkYear === year - 1;
  });
}

export { parsePdfFilenameDate };
