/**
 * 姫島村議会 — list フェーズ
 *
 * 姫島村の議会ページから PDF リンクを抽出し、会議関連資料だけを返す。
 * 2026-03-28 時点で確認できる公開 PDF は議員名簿や議会構成一覧表のみで、
 * 発言全文付き会議録は見当たらない。
 */

import {
  BASE_ORIGIN,
  classifyDocumentKind,
  detectMeetingType,
  extractYearFromText,
  fetchPage,
  isMeetingRelatedDocument,
  parseDateText,
  type DocumentKind,
} from "./shared";

export interface HimeshimaDocumentLink {
  pdfUrl: string;
  linkText: string;
  kind: DocumentKind;
  year: number | null;
  heldOn: string | null;
  title: string;
  meetingType: string;
}

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeText(text: string): string {
  return decodeHtml(text.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePageLinks(html: string): HimeshimaDocumentLink[] {
  const links: HimeshimaDocumentLink[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href=["']([^"']+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = normalizeText(match[2]!);
    if (!linkText) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    if (!isMeetingRelatedDocument(linkText, pdfUrl)) continue;

    const sourceText = `${linkText} ${pdfUrl}`;
    links.push({
      pdfUrl,
      linkText,
      kind: classifyDocumentKind(linkText, pdfUrl),
      year: extractYearFromText(sourceText),
      heldOn: parseDateText(sourceText),
      title: linkText,
      meetingType: detectMeetingType(linkText),
    });
  }

  return links;
}

export async function fetchDocumentList(
  baseUrl: string,
  year: number
): Promise<HimeshimaDocumentLink[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parsePageLinks(html).filter((link) => link.year === year || link.year === null);
}
