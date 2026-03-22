/**
 * 東村山市 — list フェーズ
 *
 * 年度別 HTML ページから PDF リンクを抽出する。
 * URL: https://www.city.higashimurayama.tokyo.jp/gikai/gikaijoho/kensaku/{era}{num}_{type}/index.html
 */

import { BASE_ORIGIN, fetchPage, toEraPrefix, buildListUrl } from "./shared";

export interface HigashimurayamaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
  category: "honkaigi" | "iinkai";
}

/**
 * リンクテキストから開催日を抽出する。
 * e.g., "第1回　令和6年2月21日（PDF：966KB）" → "2024-02-21"
 */
function parseDateFromLinkText(text: string): string | null {
  const match = text.match(/(令和|平成|昭和)(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else if (era === "昭和") westernYear = eraYear + 1925;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTitleFromLinkText(text: string): string {
  return text.replace(/（PDF[：:].*?）/, "").trim();
}

/**
 * HTML ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 */
export function parseListPage(
  html: string,
  category: "honkaigi" | "iinkai"
): HigashimurayamaMeeting[] {
  const results: HigashimurayamaMeeting[] = [];

  const sections: { index: number; name: string }[] = [];
  const h2Pattern = /<h2>([^<]+)<\/h2>/g;
  let h2Match;
  while ((h2Match = h2Pattern.exec(html)) !== null) {
    sections.push({ index: h2Match.index, name: h2Match[1]!.trim() });
  }

  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([^<]+)<\/a>/g;
  let linkMatch;
  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const linkIndex = linkMatch.index;
    const pdfPath = linkMatch[1]!;
    const linkText = linkMatch[2]!;

    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.name;
      }
    }

    const heldOn = parseDateFromLinkText(linkText);
    if (!heldOn) continue;

    const pdfUrl = pdfPath.startsWith("http")
      ? pdfPath
      : `${BASE_ORIGIN}${pdfPath.startsWith("/") ? "" : "/"}${pdfPath}`;

    const linkTitle = parseTitleFromLinkText(linkText);
    const title = currentSection
      ? `${currentSection} ${linkTitle}`
      : linkTitle;

    results.push({ pdfUrl, title, heldOn, section: currentSection, category });
  }

  return results;
}

/**
 * 指定カテゴリのページを取得して会議一覧を返す。
 * 404 の場合は既知の typo URL もフォールバック試行する。
 */
async function fetchCategoryPage(
  eraPrefix: string,
  category: "honkaigi" | "iinkai"
): Promise<HigashimurayamaMeeting[]> {
  const url = buildListUrl(eraPrefix, category);
  const html = await fetchPage(url);

  if (html) {
    return parseListPage(html, category);
  }

  // 既知の typo 対応: r7_honkagi (honkaigi の typo)
  if (category === "honkaigi") {
    const typoUrl = `${BASE_ORIGIN}/gikai/gikaijoho/kensaku/${eraPrefix}_honkagi/index.html`;
    const typoHtml = await fetchPage(typoUrl);
    if (typoHtml) {
      return parseListPage(typoHtml, category);
    }
  }

  return [];
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<HigashimurayamaMeeting[]> {
  const eraPrefix = toEraPrefix(year);
  if (!eraPrefix) return [];

  const results: HigashimurayamaMeeting[] = [];

  const honkaigiMeetings = await fetchCategoryPage(eraPrefix, "honkaigi");
  results.push(...honkaigiMeetings);

  // 委員会ページは h14 / 2002年以降のみ存在
  if (year >= 2002) {
    const iinkaiMeetings = await fetchCategoryPage(eraPrefix, "iinkai");
    results.push(...iinkaiMeetings);
  }

  return results;
}
