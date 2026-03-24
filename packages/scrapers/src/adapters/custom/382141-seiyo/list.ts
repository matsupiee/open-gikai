/**
 * 西予市議会 会議録 — list フェーズ
 *
 * 以下の4カテゴリのインデックスページから末端ページ URL を収集し、
 * 各末端ページから PDF リンクとメタ情報を収集する。
 *
 * 1. 本会議: honkaigi/index.html → 年度別ページ → PDF リンク
 * 2. 常任委員会: joniniinkai/index.html → 委員会別ページ → PDF リンク
 * 3. 特別委員会: tokubetsuiinkai/index.html → 委員会別ページ → PDF リンク
 * 4. 全員協議会: zeninkyougikai/index.html → 一覧ページ → PDF リンク
 *
 * PDF リンクのテキスト形式:
 *   【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)
 *   【会議録】令和6年第1回臨時会（5月17日）(PDFファイル: 623.5KB)
 */

import { BASE_URL, INDEX_URLS, fetchPage, eraToWesternYear, delay } from "./shared";

export interface SeiyoMeeting {
  /** 会議タイトル（例: "令和6年第2回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * インデックスページから末端ページへのリンクを抽出する。
 * href が /shisei/shigikai/kaigiroku/ 配下の .html リンクを対象とする。
 * index.html 自体はスキップする。
 */
export function extractSubPageLinks(html: string, indexUrl: string): string[] {
  const baseDir = indexUrl.replace(/\/index\.html$/, "/");
  const results: string[] = [];

  // <a href="..."> のパターンでリンクを抽出
  const linkPattern = /<a\s[^>]*href="([^"]+\.html)"[^>]*>/gi;

  let m: RegExpExecArray | null;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1]!.trim();

    // index.html はスキップ
    if (href.endsWith("index.html")) continue;

    // 絶対 URL に変換
    let fullUrl: string;
    if (href.startsWith("http")) {
      fullUrl = href;
    } else if (href.startsWith("//")) {
      fullUrl = "https:" + href;
    } else if (href.startsWith("/")) {
      fullUrl = `${BASE_URL}${href}`;
    } else {
      fullUrl = `${baseDir}${href}`;
    }

    // 対象ドメインのページのみ
    if (!fullUrl.includes("city.seiyo.ehime.jp")) continue;

    if (!results.includes(fullUrl)) {
      results.push(fullUrl);
    }
  }

  return results;
}

/**
 * PDF リンクページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * リンクテキスト形式:
 *   【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)
 *   【会議録】令和5年第3回定例会（9月4日）(PDFファイル: 1.2MB)
 *
 * 委員会ページでは h3 で年度区切りがある場合もあるが、
 * リンクテキスト内に年号が含まれるためリンクテキストのみで解析可能。
 */
export function extractPdfLinks(html: string): SeiyoMeeting[] {
  const results: SeiyoMeeting[] = [];

  // /material/files/group/34/ を含む PDF リンクを抽出
  const pdfPattern = /<a\s[^>]*href="([^"]*\/material\/files\/group\/34\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const rawText = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .trim();

    if (!rawText) continue;

    // 絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = "https:" + href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_URL}${href}`;
    } else {
      pdfUrl = `${BASE_URL}/${href}`;
    }

    const meeting = parseLinkText(rawText, pdfUrl);
    if (meeting) {
      results.push(meeting);
    }
  }

  return results;
}

/**
 * リンクテキストからメタ情報を解析する。
 *
 * 形式: 【会議録】令和6年第2回定例会（6月10日～6月27日）(PDFファイル: 2.6MB)
 *       【会議録】令和6年第1回臨時会（5月17日）
 *       【会議録】令和6年第3回定例会（9月10日～9月27日）
 *
 * 委員会の場合（h3 の年度区切り付き）:
 *   総務常任委員会（令和6年6月19日）
 *   総務常任委員会（令和6年12月13日）
 */
export function parseLinkText(
  text: string,
  pdfUrl: string,
): SeiyoMeeting | null {
  // ファイルサイズ情報を除去
  const cleaned = text.replace(/\(PDFファイル[^)]*\)|\(PDF[^)]*\)/g, "").trim();

  // タイトルを抽出（【会議録】プレフィックスを除去）
  const titleRaw = cleaned.replace(/^【会議録】/, "").trim();

  // 開催日を解析
  const heldOn = parseDateFromText(cleaned);

  // タイトル部分: 括弧の前まで（日付括弧を除いた会議名）
  // 例: "令和6年第2回定例会（6月10日～6月27日）" → "令和6年第2回定例会"
  const titleMatch = titleRaw.match(/^(.+?)（/);
  const title = titleMatch ? titleMatch[1]!.trim() : titleRaw;

  if (!title) return null;

  return {
    title,
    heldOn,
    pdfUrl,
  };
}

/**
 * テキストから開催日 YYYY-MM-DD を解析する。
 *
 * パターン1（単日）: （5月17日）, （令和6年5月17日）
 * パターン2（会期）: （6月10日～6月27日）→ 開始日を採用
 * パターン3（リンクテキスト冒頭の年号 + 括弧内の月日）:
 *   "令和6年第2回定例会（6月10日～6月27日）" → 令和6年 + 6月10日
 */
export function parseDateFromText(text: string): string | null {
  // まずテキスト全体から年号を取得
  const yearMatch = text.match(/(令和|平成)(元|\d+)年/);
  const westernYear = yearMatch ? eraToWesternYear(yearMatch[0]) : null;

  // 括弧内の日付を取得（最初の括弧を使用）
  // 全角括弧（...）のパターン
  const parenMatch = text.match(/（([^）]+)）/);
  if (parenMatch) {
    const dateText = parenMatch[1]!;

    // 会期パターン（XX月XX日～XX月XX日）→ 開始日を採用
    const periodMatch = dateText.match(/^(\d+)月(\d+)日[～〜](\d+)月(\d+)日$/);
    if (periodMatch && westernYear) {
      const month = parseInt(periodMatch[1]!, 10);
      const day = parseInt(periodMatch[2]!, 10);
      return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // 単日パターン（XX月XX日）
    const singleMatch = dateText.match(/^(\d+)月(\d+)日$/);
    if (singleMatch && westernYear) {
      const month = parseInt(singleMatch[1]!, 10);
      const day = parseInt(singleMatch[2]!, 10);
      return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // 括弧内に年号+月日がある場合（例: 令和6年12月13日）
    const fullDateMatch = dateText.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
    if (fullDateMatch) {
      const year = eraToWesternYear(`${fullDateMatch[1]}${fullDateMatch[2]}年`);
      if (year) {
        const month = parseInt(fullDateMatch[3]!, 10);
        const day = parseInt(fullDateMatch[4]!, 10);
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 4つのカテゴリインデックスを巡回し、対象年の会議録を収集する。
 */
export async function fetchMeetingList(year: number): Promise<SeiyoMeeting[]> {
  const allMeetings: SeiyoMeeting[] = [];

  for (const [, indexUrl] of Object.entries(INDEX_URLS)) {
    const indexHtml = await fetchPage(indexUrl);
    if (!indexHtml) continue;

    await delay(INTER_PAGE_DELAY_MS);

    const subPageUrls = extractSubPageLinks(indexHtml, indexUrl);

    for (const subPageUrl of subPageUrls) {
      const subPageHtml = await fetchPage(subPageUrl);
      if (!subPageHtml) continue;

      await delay(INTER_PAGE_DELAY_MS);

      const meetings = extractPdfLinks(subPageHtml);
      allMeetings.push(...meetings);
    }
  }

  // 対象年でフィルタ（heldOn がある場合のみ、または年タイトルで判定）
  return allMeetings.filter((m) => {
    if (m.heldOn) {
      const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
      return meetingYear === year;
    }
    // heldOn がない場合はタイトルの年号で判断
    const titleYearMatch = m.title.match(/(令和|平成)(元|\d+)年/);
    if (titleYearMatch) {
      const titleYear = eraToWesternYear(titleYearMatch[0]);
      return titleYear === year;
    }
    return false;
  });
}
