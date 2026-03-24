/**
 * 幕別町議会 会議録 — list フェーズ
 *
 * 4 つの一覧ページ（定例会・臨時会、常任委員会、議会運営委員会、特別委員会）から
 * 全年度の PDF リンクを収集する。
 *
 * HTML 構造:
 *   定例会・臨時会ページ (1898.html):
 *     h2（年号: "令和7年" など）
 *     ul > li > a[href=".pdf"]（リンクテキスト: "第1回定例会【3月4日～3月21日開催】"）
 *
 *   委員会ページ (1897.html, 1896.html, 12568.html):
 *     h2（委員会名: "総務文教常任委員会" など）
 *     h3（年号 + 委員会名: "令和8年（総務文教常任委員会）"）
 *     ul > li > a[href=".pdf"]（リンクテキスト: "令和8年3月3日" など）
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URLS,
  eraToWesternYear,
  normalizeNumbers,
  fetchPage,
} from "./shared";

export interface MakubetsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できた場合のみ） */
  heldOn: string | null;
  /** 会議種別（例: "第1回定例会"、"総務文教常任委員会" など） */
  category: string;
}

/** HTML タグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

/**
 * リンクテキストから開催日（YYYY-MM-DD）を抽出する。
 *
 * 対応パターン:
 *   "第1回臨時会【1月16日開催】" → year=currentYear, month=1, day=16
 *   "第１回定例会 【3月4日～3月21日開催】" → year=currentYear, month=3, day=4 (初日)
 *   "令和8年3月3日" → 2026-03-03
 *   "【令和7年9月17、18、19日開催】令和6年度決算審査特別委員会" → 2025-09-17
 *   "第1回[令和元年12月20日]" → 2019-12-20
 */
export function extractHeldOn(
  linkText: string,
  currentYear: number | null,
): string | null {
  const normalized = normalizeNumbers(linkText);

  // パターン1: "令和X年M月D日" または "平成X年M月D日" を含む
  // "令和X年M月D、D日" のような複数日付形式（D日の直前に数字が不要）も対応
  const eraDateMatch = normalized.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)(?:日|[、,])/,
  );
  if (eraDateMatch) {
    const eraText = `${eraDateMatch[1]}${eraDateMatch[2]}年`;
    const westernYear = eraToWesternYear(eraText);
    if (!westernYear) return null;
    const month = parseInt(eraDateMatch[3]!, 10);
    const day = parseInt(eraDateMatch[4]!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // パターン2: 【M月D日開催】 または 【M月D日～M月D日開催】（currentYear を使用）
  if (currentYear) {
    const bracketMatch = normalized.match(/[【\[]\s*(\d+)月(\d+)日/);
    if (bracketMatch) {
      const month = parseInt(bracketMatch[1]!, 10);
      const day = parseInt(bracketMatch[2]!, 10);
      return `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // パターン3: M月D日開催（【】なし）
    const simpleDateMatch = normalized.match(/(\d+)月(\d+)日/);
    if (simpleDateMatch) {
      const month = parseInt(simpleDateMatch[1]!, 10);
      const day = parseInt(simpleDateMatch[2]!, 10);
      return `${currentYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * 見出しテキストから西暦年を抽出する。
 * h2 または h3 見出し内の年号テキストをパースする。
 *
 * 対応パターン:
 *   "令和7年" → 2025
 *   "令和8年（総務文教常任委員会）" → 2026
 *   "平成29年（産業建設常任委員会）" → 2017
 */
export function extractYearFromHeading(heading: string): number | null {
  return eraToWesternYear(normalizeNumbers(heading));
}

/**
 * 一覧ページ HTML をパースして PDF リンク一覧を返す（テスト可能な純粋関数）。
 *
 * h2 をセクション区切りとして使用する。
 * - 定例会・臨時会ページ: h2 が年号 → currentYear を更新
 * - 委員会ページ: h2 が委員会名（年号なし）、h3 が年号
 * どちらの場合も最後に見つかった年号の heading で currentYear を管理する。
 */
export function parseListPage(html: string): MakubetsuMeeting[] {
  const results: MakubetsuMeeting[] = [];

  // h2 と h3 見出しの位置・テキストを収集
  const headingPattern = /<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings: { index: number; level: string; text: string }[] = [];
  for (const match of html.matchAll(headingPattern)) {
    const text = stripHtml(match[2]!);
    headings.push({ index: match.index!, level: match[1]!, text });
  }

  // a タグ（.pdf リンク）を収集
  const linkPattern = /<a[^>]+href="([^"]*\.pdf[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const linkMatch of html.matchAll(linkPattern)) {
    const href = linkMatch[1]!;
    const linkText = stripHtml(linkMatch[2]!).replace(/\s+/g, " ").trim();
    const linkIndex = linkMatch.index!;

    if (!href || !linkText) continue;

    // このリンクより前にある最後の見出しを取得
    let currentYearHeading: string | null = null;
    let currentCategoryHeading: string | null = null;

    for (const heading of headings) {
      if (heading.index >= linkIndex) break;

      const year = extractYearFromHeading(heading.text);
      if (year !== null) {
        currentYearHeading = heading.text;
      } else {
        // 年号でない見出しはカテゴリ名として扱う
        currentCategoryHeading = heading.text;
      }
    }

    const currentYear = currentYearHeading
      ? extractYearFromHeading(currentYearHeading)
      : null;

    // PDF の完全 URL を構築（日本語ファイル名は既に URL エンコードされている）
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    const heldOn = extractHeldOn(linkText, currentYear);

    // タイトルを構築
    const title = linkText;

    // カテゴリを決定
    // 委員会ページでは currentCategoryHeading が委員会名
    // 定例会・臨時会ページでは linkText から会議種別を取得
    const category = currentCategoryHeading ?? "";

    results.push({
      pdfUrl,
      title,
      heldOn,
      category,
    });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 * 4 つの一覧ページをすべて取得して結合し、指定年でフィルタする。
 */
export async function fetchMeetingList(
  year: number,
): Promise<MakubetsuMeeting[]> {
  const allMeetings: MakubetsuMeeting[] = [];

  for (const url of LIST_PAGE_URLS) {
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseListPage(html);
    allMeetings.push(...meetings);
  }

  // 指定年でフィルタ（heldOn が null のものは除外）
  return allMeetings.filter((m) => {
    if (!m.heldOn) return false;
    const meetingYear = parseInt(m.heldOn.split("-")[0]!, 10);
    return meetingYear === year;
  });
}
