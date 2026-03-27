/**
 * 青木村議会 -- list フェーズ
 *
 * 一覧ページは単一ページで、`議会議事録` セクション配下に年度ごとの PDF リンクが並ぶ。
 * 後続の `議会一般質問（音声）` セクションは対象外。
 */

import {
  buildDocumentUrl,
  buildListUrl,
  detectMeetingType,
  fetchPage,
  normalizeYearLabel,
  parseHeadingYear,
} from "./shared";

export interface AokiPdfLink {
  title: string;
  pdfUrl: string;
  meetingType: "plenary" | "committee" | "extraordinary";
  headingYear: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseListPage(html: string): AokiPdfLink[] {
  const results: AokiPdfLink[] = [];
  const tokenPattern =
    /<(h4|h5|h6)[^>]*>([\s\S]*?)<\/\1>|<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let inMinutesSection = false;
  let currentYear: number | null = null;
  let currentYearLabel = "";

  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(html)) !== null) {
    const tag = m[1];
    if (tag) {
      const text = stripHtml(m[2] ?? "");

      if (tag === "h4") {
        inMinutesSection = text.includes("議会議事録");
        if (!inMinutesSection) {
          currentYear = null;
          currentYearLabel = "";
        }
        continue;
      }

      if (!inMinutesSection) continue;

      if (tag === "h6") {
        break;
      }

      if (tag === "h5") {
        currentYear = parseHeadingYear(text);
        currentYearLabel = normalizeYearLabel(text);
      }

      continue;
    }

    if (!inMinutesSection || currentYear === null) continue;

    const href = m[3] ?? "";
    const linkText = stripHtml(m[4] ?? "").replace(/^・\s*/, "");
    if (!href || !/\.pdf(?:$|[?#])/i.test(href) || !linkText) continue;
    if (!linkText.includes("定例会") && !linkText.includes("臨時会")) continue;

    results.push({
      title: `${currentYearLabel} ${linkText}`.trim(),
      pdfUrl: buildDocumentUrl(href),
      meetingType: detectMeetingType(linkText),
      headingYear: currentYear,
    });
  }

  return results;
}

export async function fetchDocumentList(
  baseUrl: string,
  year: number,
): Promise<AokiPdfLink[]> {
  const html = await fetchPage(buildListUrl(baseUrl));
  if (!html) return [];

  return parseListPage(html).filter((doc) => doc.headingYear === year);
}
