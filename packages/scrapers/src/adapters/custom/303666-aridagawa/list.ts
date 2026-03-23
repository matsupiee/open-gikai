/**
 * 有田川町議会 会議録 -- list フェーズ
 *
 * 1. 会議録一覧トップ (kaigiroku/index.html) から年度別ページ URL を特定
 * 2. 年度別ページから PDF リンクを全件抽出
 *
 * 一覧トップのリンク構造:
 *   <a href="https://www.town.aridagawa.lg.jp/top/kakuka/gikai/kaigiroku/9452.html">
 *     令和7年 本会議会議録
 *   </a>
 *
 * 年度ページの構造:
 *   <div class="wysiwyg">
 *     <h2>令和6年第4回定例会（令和6年12月3日～12月17日）</h2>
 *   </div>
 *   <p class="file...">
 *     <a href="//www.town.aridagawa.lg.jp/material/files/group/12/R6-4-1teireiR061203.pdf">
 *       令和6年12月3日本会議会議録 (PDFファイル: 348.2KB)
 *     </a>
 *   </p>
 */

import {
  BASE_ORIGIN,
  INDEX_PATH,
  detectMeetingType,
  fetchPage,
  parsePdfFilename,
  toWareki,
} from "./shared";

export interface AridagawaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第2回定例会 第1日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（plenary / extraordinary） */
  meetingType: string;
}

/**
 * 会議録一覧トップ HTML から年度別ページ URL を抽出する。
 * リンクテキストに「令和N年」「平成N年」を含むものを和暦→西暦変換して返す。
 */
export function parseIndexPage(
  html: string
): { year: number; url: string }[] {
  const results: { year: number; url: string }[] = [];

  const linkPattern =
    /<a\s[^>]*href="([^"]*\/kaigiroku\/\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // 令和N年 or 平成N年 を抽出
    const eraMatch = linkText.match(/(?:令和|平成)(\d+|元)年/);
    if (!eraMatch) continue;

    let year: number;
    if (linkText.includes("令和")) {
      const eraYear = eraMatch[1] === "元" ? 1 : parseInt(eraMatch[1]!, 10);
      year = 2018 + eraYear;
    } else {
      const eraYear = eraMatch[1] === "元" ? 1 : parseInt(eraMatch[1]!, 10);
      year = 1988 + eraYear;
    }

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ year, url });
  }

  return results;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出する。
 *
 * h3 の会議タイトル（例: "令和6年第4回定例会（令和6年12月3日～12月17日）"）と
 * その配下の PDF リンクを紐付ける。
 */
export function parseYearPage(html: string): AridagawaMeeting[] {
  const meetings: AridagawaMeeting[] = [];

  // h2 ごとにセクションを分割（年度ページでは h2 で会議セクションを区切る）
  const h2Pattern = /<h2[^>]*>(.*?)<\/h2>/gi;
  const h2Matches = [...html.matchAll(h2Pattern)];

  for (let i = 0; i < h2Matches.length; i++) {
    const h2Match = h2Matches[i]!;
    const sectionTitle = h2Match[1]!.replace(/<[^>]+>/g, "").trim();

    // 会議タイトルから回数と種別を抽出
    const sessionMatch = sectionTitle.match(/第(\d+)回(定例会|臨時会)/);
    if (!sessionMatch) continue;

    const sessionNum = sessionMatch[1]!;
    const sessionType = sessionMatch[2]!;

    const startIdx = h2Match.index! + h2Match[0].length;
    const endIdx =
      i + 1 < h2Matches.length ? h2Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    // PDF リンクを抽出
    const pdfPattern =
      /<a\s[^>]*href="([^"]*\/material\/files\/group\/12\/[^"]+\.pdf)"[^>]*>([^<]+)<\/a>/gi;

    for (const pdfMatch of sectionHtml.matchAll(pdfPattern)) {
      let href = pdfMatch[1]!;

      // protocol-relative URL を https に変換
      if (href.startsWith("//")) {
        href = `https:${href}`;
      } else if (!href.startsWith("http")) {
        href = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
      }

      const filename = href.split("/").pop() ?? "";
      const parsed = parsePdfFilename(filename);
      if (!parsed) continue;

      const meetingType = detectMeetingType(sessionType);
      const title = `第${sessionNum}回${sessionType} 第${parsed.dayNumber}日`;

      meetings.push({
        pdfUrl: href,
        title,
        heldOn: parsed.heldOn,
        meetingType,
      });
    }
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<AridagawaMeeting[]> {
  const wareki = toWareki(year);
  if (!wareki) return [];

  // Step 1: 一覧トップから年度別ページ URL を取得
  const indexUrl = `${BASE_ORIGIN}${INDEX_PATH}`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  // Step 2: 年度別ページから PDF リンクを取得
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml);
}
