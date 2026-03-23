/**
 * 平群町議会 -- list フェーズ
 *
 * 2段階クロールで PDF リンクを収集する:
 * 1. インデックスページから年度別/委員会別ページ URL を取得
 * 2. 各ページから PDF リンクとメタ情報を抽出
 *
 * 本会議録インデックス: /site/gikai/list47-37.html
 *   → 年度別ページ: /site/gikai/{page_id}.html
 *     → PDF リンク: /uploaded/attachment/{id}.pdf
 *
 * 委員会会議録インデックス: /site/gikai/list47-82.html
 *   → 委員会別ページ: /site/gikai/{page_id}.html
 *     → PDF リンク: /uploaded/attachment/{id}.pdf
 */

import {
  BASE_ORIGIN,
  COMMITTEE_INDEX_PATH,
  PLENARY_INDEX_PATH,
  eraToWesternYear,
  fetchPage,
  toJapaneseEra,
} from "./shared";

export interface HeguriMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string; // YYYY-MM-DD
  section: string;
}

/**
 * インデックスページからサブページのリンクを抽出する。
 * 本会議録: 年度別ページリンク (例: "令和7年本会議録" → /site/gikai/15030.html)
 * 委員会: 委員会別ページリンク (例: "文教厚生委員会" → /site/gikai/1895.html)
 */
export function parseIndexPage(html: string): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*\/site\/gikai\/\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[2]!.trim();

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ label, url });
  }

  return results;
}

/**
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * 「元」にも対応: "令和元年6月5日" → "2019-06-05"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 本会議録の年度別ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <h2>令和7年　第2回3月定例会会議録</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/11193.pdf">第1日目（令和7年3月4日）[PDFファイル／984KB]</a></li>
 *     ...
 *   </ul>
 */
export function parsePlenaryPage(html: string): HeguriMeeting[] {
  const results: HeguriMeeting[] = [];

  // h2 見出しの位置を収集
  const sections: { index: number; heading: string; sessionName: string }[] = [];
  const headingPattern = /<h2[^>]*>([^<]*(?:定例会|臨時会)[^<]*)<\/h2>/g;
  for (const match of html.matchAll(headingPattern)) {
    const heading = match[1]!.trim();
    // "令和7年　第2回3月定例会会議録" → "第2回3月定例会"
    const sessionMatch = heading.match(/(第\d+回\d+月(?:定例会|臨時会))/);
    const sessionName = sessionMatch ? sessionMatch[1]! : heading.replace(/会議録$/, "").trim();
    sections.push({ index: match.index!, heading, sessionName });
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const pdfPath = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 現在のセクションを特定
    let currentSection = "";
    for (const section of sections) {
      if (section.index < linkIndex) {
        currentSection = section.sessionName;
      }
    }

    // リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;

    // タイトル: "第2回3月定例会 第1日目"
    const dayMatch = linkText.match(/(第\d+日目)/);
    const dayText = dayMatch ? dayMatch[1]! : "";
    const title = currentSection
      ? `${currentSection} ${dayText}`.trim()
      : dayText || linkText;

    results.push({ pdfUrl, title, heldOn, section: currentSection });
  }

  return results;
}

/**
 * 委員会会議録ページから PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <h2>令和7年12月</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/12508.pdf">令和7年12月4日 [PDFファイル／559KB]</a></li>
 *   </ul>
 *
 * 予算審査特別委員会:
 *   <h2>令和7年3月　予算審査特別委員会</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/11811.pdf">一般会計（令和7年3月7日） [PDFファイル／1.38MB]</a></li>
 *     <li><a href="/uploaded/attachment/11812.pdf">各特別会計・各事業会計（令和7年3月10日） [PDFファイル／487KB]</a></li>
 *   </ul>
 */
export function parseCommitteePage(
  html: string,
  committeeName: string
): HeguriMeeting[] {
  const results: HeguriMeeting[] = [];

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const pdfPath = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // リンクテキストから日付を抽出
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const pdfUrl = `${BASE_ORIGIN}${pdfPath}`;

    // タイトル: "文教厚生委員会 令和7年12月4日" or "予算審査特別委員会 一般会計"
    const accountMatch = linkText.match(/^(一般会計|各特別会計[^（(]*)/);
    const titleSuffix = accountMatch ? accountMatch[1]!.trim() : "";
    const title = titleSuffix
      ? `${committeeName} ${titleSuffix}`
      : committeeName;

    results.push({ pdfUrl, title, heldOn, section: committeeName });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 本会議録と委員会会議録の両方を返す。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<HeguriMeeting[]> {
  const eraTexts = toJapaneseEra(year);
  const allMeetings: HeguriMeeting[] = [];

  // --- 本会議録 ---
  const plenaryIndexUrl = `${BASE_ORIGIN}${PLENARY_INDEX_PATH}`;
  const plenaryIndexHtml = await fetchPage(plenaryIndexUrl);
  if (plenaryIndexHtml) {
    const yearPages = parseIndexPage(plenaryIndexHtml);
    // 対象年度のページを見つける
    const targetPage = yearPages.find((p) =>
      eraTexts.some((era) => p.label.includes(era))
    );
    if (targetPage) {
      const yearHtml = await fetchPage(targetPage.url);
      if (yearHtml) {
        allMeetings.push(...parsePlenaryPage(yearHtml));
      }
    }
  }

  // --- 委員会会議録 ---
  const committeeIndexUrl = `${BASE_ORIGIN}${COMMITTEE_INDEX_PATH}`;
  const committeeIndexHtml = await fetchPage(committeeIndexUrl);
  if (committeeIndexHtml) {
    const committeePages = parseIndexPage(committeeIndexHtml);

    for (let i = 0; i < committeePages.length; i++) {
      const cp = committeePages[i]!;
      const committeeHtml = await fetchPage(cp.url);
      if (!committeeHtml) continue;

      // 委員会ページ内の全 PDF から対象年のものだけを抽出
      const meetings = parseCommitteePage(committeeHtml, cp.label);
      const filtered = meetings.filter((m) => {
        const meetingYear = eraToWesternYear(extractEraFromDate(m.heldOn));
        return meetingYear === year;
      });
      allMeetings.push(...filtered);

      // レート制限: 最後のリクエスト以外は待機
      if (i < committeePages.length - 1) {
        await new Promise((r) => setTimeout(r, 1_000));
      }
    }
  }

  return allMeetings;
}

/** YYYY-MM-DD から和暦テキストを生成（年の判定用） */
function extractEraFromDate(isoDate: string): string {
  const y = Number(isoDate.slice(0, 4));
  if (y >= 2020) return `令和${y - 2018}年`;
  if (y === 2019) return "令和元年";
  if (y >= 1989) {
    const eraYear = y - 1988;
    return eraYear === 1 ? "平成元年" : `平成${eraYear}年`;
  }
  return "";
}
