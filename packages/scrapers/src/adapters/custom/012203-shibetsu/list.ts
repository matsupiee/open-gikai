/**
 * 士別市議会 会議録 — list フェーズ
 *
 * 年度別ページから PDF リンクとメタ情報を収集する。
 *
 * 年度別ページの構造:
 *   <h2> 会議種別見出し（例: 令和7年第1回定例会大綱質疑）
 *     <h3> 日付（例: 令和7年3月4日）
 *       <a href="//www.city.shibetsu.lg.jp/material/files/group/36/R7-1tei-2.pdf">PDF リンク</a>
 *       <h4> 議員名（会派名）
 *         <ol> 質問項目リスト
 *
 * PDF リンクは "//" で始まる（プロトコルスキーム省略形式）。
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  YEAR_PAGE_IDS,
  detectMeetingType,
  fetchPage,
  parseDateFromText,
} from "./shared";

export interface ShibetsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年第1回定例会大綱質疑 令和7年3月4日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * h2 → h3 → a(.pdf) の階層構造を追跡して各 PDF のメタ情報を収集する。
 */
export function parseYearPage(html: string): ShibetsuMeeting[] {
  const results: ShibetsuMeeting[] = [];

  // タグを行として処理するため、改行で正規化
  const normalized = html.replace(/\r\n?/g, "\n");

  // h2 セクションを分割して処理
  // <h2>...</h2> を区切りとして各セクションを処理
  const h2SectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2[^>]*>|$)/gi;
  const h2Sections = [...normalized.matchAll(h2SectionPattern)];

  for (const h2Section of h2Sections) {
    const h2Text = h2Section[1]!.replace(/<[^>]+>/g, "").trim();
    const sectionContent = h2Section[2]!;
    const meetingType = detectMeetingType(h2Text);

    // h3 セクションを分割（開催日ごと）
    const h3SectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;
    const h3Sections = [...sectionContent.matchAll(h3SectionPattern)];

    for (const h3Section of h3Sections) {
      const h3Text = h3Section[1]!.replace(/<[^>]+>/g, "").trim();
      const h3Content = h3Section[2]!;
      const heldOn = parseDateFromText(h3Text);

      // h3 内の PDF リンクを抽出
      const pdfLinkPattern =
        /<a[^>]+href="((?:https?:)?\/\/[^"]+\.pdf)"[^>]*>/gi;

      for (const pdfMatch of h3Content.matchAll(pdfLinkPattern)) {
        const rawHref = pdfMatch[1]!;
        // "//" で始まる場合は https: を補完
        const pdfUrl = rawHref.startsWith("//")
          ? `https:${rawHref}`
          : rawHref;

        const title = heldOn
          ? `${h2Text} ${h3Text}`
          : h2Text;

        results.push({
          pdfUrl,
          title,
          heldOn,
          meetingType,
        });
      }
    }

    // h3 がない場合でも h2 セクション直下の PDF リンクを収集
    if (h3Sections.length === 0) {
      const pdfLinkPattern =
        /<a[^>]+href="((?:https?:)?\/\/[^"]+\.pdf)"[^>]*>/gi;

      for (const pdfMatch of sectionContent.matchAll(pdfLinkPattern)) {
        const rawHref = pdfMatch[1]!;
        const pdfUrl = rawHref.startsWith("//")
          ? `https:${rawHref}`
          : rawHref;

        results.push({
          pdfUrl,
          title: h2Text,
          heldOn: null,
          meetingType,
        });
      }
    }
  }

  // h2 が見つからない場合のフォールバック: すべての PDF リンクを収集
  if (h2Sections.length === 0) {
    const pdfLinkPattern =
      /<a[^>]+href="((?:https?:)?\/\/[^"]+\.pdf)"[^>]*>/gi;

    for (const pdfMatch of normalized.matchAll(pdfLinkPattern)) {
      const rawHref = pdfMatch[1]!;
      const pdfUrl = rawHref.startsWith("//")
        ? `https:${rawHref}`
        : rawHref;

      results.push({
        pdfUrl,
        title: "会議録",
        heldOn: null,
        meetingType: "plenary",
      });
    }
  }

  return results;
}

/**
 * 年度ページの URL を返す。
 * YEAR_PAGE_IDS に定義がある場合はそれを使い、なければ index.html からリンクを収集する。
 */
export function getYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_IDS[year];
  if (pageId) {
    return `${BASE_ORIGIN}/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/${pageId}.html`;
  }
  return null;
}

/**
 * index.html から年度別ページへのリンクを収集する。
 */
export function parseIndexPage(html: string): string[] {
  const urls: string[] = [];
  const linkPattern =
    /<a[^>]+href="([^"]*\/kaigirokukennsaku\/(\d+)\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const pageId = match[2]!;
    // 889.html は説明ページなので除外
    if (pageId === "889") continue;

    const fullUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<ShibetsuMeeting[]> {
  // 年度ページの URL を取得
  let yearPageUrl = getYearPageUrl(year);

  if (!yearPageUrl) {
    // index.html からリンクを探す
    const indexHtml = await fetchPage(INDEX_URL);
    if (!indexHtml) return [];

    const allUrls = parseIndexPage(indexHtml);
    // 特定年に対応するページは見つけられないため全ページを取得して年でフィルタ
    const allMeetings: ShibetsuMeeting[] = [];
    for (const url of allUrls) {
      const html = await fetchPage(url);
      if (!html) continue;
      const meetings = parseYearPage(html);
      allMeetings.push(...meetings);
    }
    return allMeetings.filter((m) => {
      if (!m.heldOn) return false;
      return parseInt(m.heldOn.slice(0, 4), 10) === year;
    });
  }

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  const meetings = parseYearPage(html);

  // 年フィルタ（年度ページには他年のデータが混在する場合がある）
  return meetings.filter((m) => {
    if (!m.heldOn) return false;
    return parseInt(m.heldOn.slice(0, 4), 10) === year;
  });
}
