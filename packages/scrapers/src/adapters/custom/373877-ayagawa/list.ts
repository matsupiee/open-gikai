/**
 * 綾川町議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. teireikai.html から対象年度の会議ページ URL を収集
 * 2. 各会議ページから本会議録 PDF と一般質問・委員会サブページ URL を収集
 * 3. サブページから個別 PDF リンクを収集
 */

import {
  BASE_ORIGIN,
  fetchPage,
  estimateHeldOn,
} from "./shared";

export interface AyagawaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingName: string;
}

/**
 * teireikai.html から年度別の会議ページリンクを抽出する。
 *
 * HTML 構造: 年度見出し（"令和7年度　定例会・臨時会（...）"）の後に
 * 各会議ページへのリンクが並ぶ。
 *
 * 返り値: { fiscalYear, meetingName, url }[]
 */
export function parseIndexPage(
  html: string
): { fiscalYear: number; meetingName: string; url: string }[] {
  const results: { fiscalYear: number; meetingName: string; url: string }[] =
    [];

  // 年度見出しのパターン: "令和N年度" を検出
  const yearPattern = /令和[元\d]+年度/g;
  const yearPositions: { index: number; fiscalYear: number }[] = [];

  for (const match of html.matchAll(yearPattern)) {
    const eraText = match[0]!;
    let reiwaYear: number;
    if (eraText.includes("元")) {
      reiwaYear = 1;
    } else {
      const numMatch = eraText.match(/令和(\d+)年度/);
      reiwaYear = numMatch ? parseInt(numMatch[1]!, 10) : 0;
    }
    if (reiwaYear > 0) {
      yearPositions.push({
        index: match.index!,
        fiscalYear: reiwaYear + 2018,
      });
    }
  }

  // 会議ページリンクのパターン
  const linkPattern =
    /<a[^>]+href="([^"]+\.html)"[^>]*>\s*((?:\d+月)?[^<]*?(?:定例会|臨時会)[^<]*?)\s*<\/a>/g;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();
    const linkIndex = match.index!;

    // ナビゲーションリンクをスキップ
    if (href === "teireikai.html") continue;

    // 会議ページのみ対象（定例会・臨時会を含むリンクテキスト）
    if (!linkText.includes("定例会") && !linkText.includes("臨時会")) continue;

    // このリンクがどの年度に属するか判定
    let fiscalYear = 0;
    for (const yp of yearPositions) {
      if (yp.index < linkIndex) {
        fiscalYear = yp.fiscalYear;
      }
    }
    if (fiscalYear === 0) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}/${href.replace(/^\//, "")}`;

    results.push({
      fiscalYear,
      meetingName: linkText,
      url,
    });
  }

  return results;
}

/**
 * 個別の会議ページ HTML からコンテンツリンクを抽出する。
 *
 * 会議ページには以下のリンクが含まれる:
 * - 本会議録 PDF: href="img/XXX.pdf" text="会議録（PDF）"
 * - 一般質問サブページ: href="XXXippanshitsumon.html" text="一般質問"
 * - 委員会サブページ: href="XXXiinkai.html" text="常任委員会" / "決算審査特別委員会"
 */
export function parseMeetingPage(
  html: string,
  pageUrl: string
): {
  pdfLinks: { url: string; text: string }[];
  subPages: { url: string; text: string }[];
} {
  const pdfLinks: { url: string; text: string }[] = [];
  const subPages: { url: string; text: string }[] = [];

  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // ナビゲーションリンクをスキップ
    if (isNavLink(href)) continue;

    if (href.endsWith(".pdf")) {
      const url = href.startsWith("http")
        ? href
        : `${baseUrl}${href.replace(/^\.\//, "")}`;
      pdfLinks.push({ url, text: linkText });
    } else if (
      href.endsWith(".html") &&
      (linkText.includes("一般質問") ||
        linkText.includes("委員会"))
    ) {
      const url = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}/${href.replace(/^\//, "")}`;
      subPages.push({ url, text: linkText });
    }
  }

  return { pdfLinks, subPages };
}

/**
 * 一般質問・委員会サブページから PDF リンクを抽出する。
 *
 * 一般質問ページの構造:
 * - テーブル内に質問者名と PDF リンクが並ぶ
 * - href="img/file36.pdf" text="一般質問会議録"
 * - href="img/202506fukerichikogiin.pdf" text="一般質問会議録"
 *
 * 委員会ページの構造:
 * - さらにサブページ（総務常任委員会・厚生常任委員会等）へのリンクがある場合がある
 * - 直接 PDF リンクがある場合もある
 */
export function parseSubPage(
  html: string,
  pageUrl: string
): {
  pdfLinks: { url: string; text: string; speakerName: string | null }[];
  subPages: { url: string; text: string }[];
} {
  const pdfLinks: {
    url: string;
    text: string;
    speakerName: string | null;
  }[] = [];
  const subPages: { url: string; text: string }[] = [];

  const baseUrl = pageUrl.replace(/\/[^/]+$/, "/");

  // PDF リンクの抽出
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    if (href.endsWith(".pdf")) {
      const url = href.startsWith("http")
        ? href
        : `${baseUrl}${href.replace(/^\.\//, "")}`;

      // 質問者名の抽出: PDF リンクの直前にある質問者名を探す
      // 簡易的にリンク周辺のテキストから抽出
      pdfLinks.push({ url, text: linkText, speakerName: null });
    } else if (
      href.endsWith(".html") &&
      linkText.includes("委員会") &&
      !isNavLink(href)
    ) {
      const url = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}/${href.replace(/^\//, "")}`;
      subPages.push({ url, text: linkText });
    }
  }

  return { pdfLinks, subPages };
}

function isNavLink(href: string): boolean {
  const navLinks = [
    "index.html",
    "greeting.html",
    "info.html",
    "gaiyou.html",
    "soshiki.html",
    "shikumi.html",
    "yakuwari.html",
    "profile.html",
    "profile1.html",
    "profile2.html",
    "teireikai.html",
    "gikaidayori.html",
    "gikaijoho.html",
    "seimukatsudohi.html",
    "ukeoijokyo.html",
    "katsudouhoukoku.html",
    "annai.html",
    "audience.html",
    "gyoseisisatsu.html",
    "seigan.html",
    "sitemap.html",
    "kihonjikou.html",
  ];
  return navLinks.includes(href);
}

/**
 * 指定年度の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<AyagawaMeeting[]> {
  // Step 1: teireikai.html から会議ページ URL を収集
  // baseUrl は ScraperAdapter インターフェースの都合で受け取るが、
  // 綾川町は固定の BASE_ORIGIN を使用する
  const indexUrl = `${BASE_ORIGIN}/teireikai.html`;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const allMeetings = parseIndexPage(indexHtml);

  // 対象年度の会議ページのみ抽出
  const targetMeetings = allMeetings.filter((m) => m.fiscalYear === year);
  if (targetMeetings.length === 0) return [];

  const results: AyagawaMeeting[] = [];

  // Step 2: 各会議ページを巡回
  for (const meeting of targetMeetings) {
    const meetingHtml = await fetchPage(meeting.url);
    if (!meetingHtml) continue;

    const heldOn = estimateHeldOn(meeting.meetingName, meeting.fiscalYear);
    if (!heldOn) continue;

    const { pdfLinks, subPages } = parseMeetingPage(meetingHtml, meeting.url);

    // 本会議録 PDF を追加
    for (const pdf of pdfLinks) {
      results.push({
        pdfUrl: pdf.url,
        title: `${meeting.meetingName} ${pdf.text}`,
        heldOn,
        meetingName: meeting.meetingName,
      });
    }

    // Step 3: サブページ（一般質問・委員会）を巡回
    for (const sub of subPages) {
      const subHtml = await fetchPage(sub.url);
      if (!subHtml) continue;

      const { pdfLinks: subPdfs, subPages: nestedSubPages } = parseSubPage(
        subHtml,
        sub.url
      );

      for (const pdf of subPdfs) {
        results.push({
          pdfUrl: pdf.url,
          title: `${meeting.meetingName} ${sub.text} ${pdf.text}`,
          heldOn,
          meetingName: meeting.meetingName,
        });
      }

      // 委員会ページがさらにサブページを持つ場合（総務常任委員会等）
      for (const nested of nestedSubPages) {
        const nestedHtml = await fetchPage(nested.url);
        if (!nestedHtml) continue;

        const { pdfLinks: nestedPdfs } = parseSubPage(nestedHtml, nested.url);
        for (const pdf of nestedPdfs) {
          results.push({
            pdfUrl: pdf.url,
            title: `${meeting.meetingName} ${nested.text} ${pdf.text}`,
            heldOn,
            meetingName: meeting.meetingName,
          });
        }
      }
    }
  }

  return results;
}
