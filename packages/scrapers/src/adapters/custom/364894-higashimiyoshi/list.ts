/**
 * 東みよし町議会 — list フェーズ
 *
 * 「東みよし町議会だより」記事ページから各号の PDF を収集する。
 * 議会だよりは年見出しごとに並んでいるが、会議開催年月は各 li テキスト
 * （例: "2025年9月議会号"）に含まれているため、それを基準に年度を判定する。
 */

import {
  LIST_PAGE_URL,
  fetchPage,
  normalizeFullWidth,
  toAbsoluteUrl,
} from "./shared";

export interface HigashimiyoshiIssue {
  title: string;
  heldOn: string;
  pdfUrl: string;
  articleUrl: string;
  issueNumber: number | null;
  year: number;
  month: number;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&#38;|&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(text: string): string {
  return decodeHtml(text).replace(/<[^>]+>/g, " ");
}

/**
 * 一覧ページ HTML から PDF レコードを抽出する。
 * year が null の場合は全件、数値の場合は該当年のみ返す。
 */
export function parseListPage(
  html: string,
  year: number | null,
): HigashimiyoshiIssue[] {
  const issues: HigashimiyoshiIssue[] = [];

  const sectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  const itemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const listHtml = sectionMatch[2] ?? "";

    for (const itemMatch of listHtml.matchAll(itemPattern)) {
      const itemHtml = itemMatch[1] ?? "";
      const pdfMatch = itemHtml.match(/<a[^>]+href="([^"]*\.pdf)"[^>]*>/i);
      if (!pdfMatch?.[1]) continue;

      const cleanText = normalizeFullWidth(
        stripTags(itemHtml).replace(/\s+/g, " ").trim(),
      );

      const titleMatch = cleanText.match(
        /((?:第\d+回臨時会＆)?\d{4}年\s*\d{1,2}月議会号)/,
      );
      if (!titleMatch?.[1]) continue;

      const title = titleMatch[1].replace(/\s+/g, "");
      const dateMatch = title.match(/(\d{4})年(\d{1,2})月議会号/);
      if (!dateMatch?.[1] || !dateMatch?.[2]) continue;

      const issueYear = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      if (Number.isNaN(issueYear) || Number.isNaN(month)) continue;
      if (year !== null && issueYear !== year) continue;

      const issueNumberMatch = cleanText.match(/No\.?\s*([0-9]+)/i);
      const issueNumber = issueNumberMatch?.[1]
        ? Number(issueNumberMatch[1])
        : null;

      issues.push({
        title,
        heldOn: `${issueYear}-${String(month).padStart(2, "0")}-01`,
        pdfUrl: toAbsoluteUrl(pdfMatch[1]),
        articleUrl: LIST_PAGE_URL,
        issueNumber,
        year: issueYear,
        month,
      });
    }
  }

  issues.sort((a, b) => {
    if (a.heldOn !== b.heldOn) return a.heldOn.localeCompare(b.heldOn);
    return (a.issueNumber ?? 0) - (b.issueNumber ?? 0);
  });

  return issues;
}

/** 指定年度の議会だより PDF 一覧を取得する。 */
export async function fetchIssueList(
  year: number,
): Promise<HigashimiyoshiIssue[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
