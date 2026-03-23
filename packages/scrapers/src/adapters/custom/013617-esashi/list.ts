/**
 * 江差町議会 -- list フェーズ
 *
 * honkaigi.html（本会議記録一覧）から全会議の詳細ページ URL を収集し、
 * 各詳細ページから kaigiroku/ 配下の PDF リンクを抽出する。
 *
 * 一覧ページの構造:
 *   年度見出し（td 内テキスト: "令和８年" 等）
 *   table border="1"
 *     tr
 *       td（リンク: <a href="honkaigiR8/honkaigiR8-03-1.html">第１回　定　例　会（３月１０日〜１１日）</a>）
 *       td（リンク: 臨時会など）
 *
 * 詳細ページから kaigiroku/ を含む PDF リンクを抽出し、-total.pdf を優先する。
 */

import {
  BASE_ORIGIN,
  DETAIL_BASE_URL,
  LIST_PAGE_URL,
  normalizeNumbers,
  yearFromDirName,
  fetchShiftJisPage,
} from "./shared";

export interface EsashiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第1回定例会 3月10日〜11日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（例: "定例会", "臨時会"） */
  category: string;
}

/** HTML タグを除去してプレーンテキストを返す */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * リンクテキストから会議種別と日付を抽出する。
 *
 * 例:
 *   "第１回　定　例　会　（　３月１０日〜１１日）" -> { category: "定例会", month: 3, day: 10 }
 *   "第１回　　臨　時　会　（　１月１６日）"       -> { category: "臨時会", month: 1, day: 16 }
 */
export function parseMeetingText(text: string): {
  category: string;
  month: number;
  day: number;
} | null {
  // 全角空白・半角空白を除去して正規化
  const normalized = normalizeNumbers(text.replace(/[\s　]+/g, ""));

  // 会議種別を抽出
  let category: string;
  if (normalized.includes("定例会")) {
    category = "定例会";
  } else if (normalized.includes("臨時会")) {
    category = "臨時会";
  } else {
    return null;
  }

  // 日付を抽出: （月日〜日）or （月日）
  const dateMatch = normalized.match(/[（(](\d+)月(\d+)日/);
  if (!dateMatch) return null;

  return {
    category,
    month: parseInt(dateMatch[1]!, 10),
    day: parseInt(dateMatch[2]!, 10),
  };
}

/**
 * 一覧ページ HTML をパースして会議詳細ページへのリンク一覧を返す。
 *
 * 各リンクに対して、href のディレクトリ名から年度を、リンクテキストから
 * 会議種別と開催日を抽出する。
 */
export function parseListPage(html: string): {
  detailUrl: string;
  title: string;
  heldOn: string;
  category: string;
  year: number;
}[] {
  const results: {
    detailUrl: string;
    title: string;
    heldOn: string;
    category: string;
    year: number;
  }[] = [];

  // <a> タグから href と text を抽出
  const linkPattern =
    /<a[^>]+href="((?:honkaigi\w+\/)?honkaigi[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = stripHtml(match[2]!);

    // ディレクトリ名から年度を推定
    const dirMatch = href.match(/^(honkaigi[^/]+)\//);
    if (!dirMatch) continue;

    const year = yearFromDirName(dirMatch[1]!);
    if (!year) continue;

    // リンクテキストから会議種別と日付をパース
    const parsed = parseMeetingText(rawText);
    if (!parsed) continue;

    const heldOn = `${year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;

    // 全角空白を除去して整形したタイトル
    const title = normalizeNumbers(rawText.replace(/[\s　]+/g, " ").trim());

    // 詳細ページ URL を構築
    const detailUrl = `${DETAIL_BASE_URL}${href}`;

    results.push({
      detailUrl,
      title,
      heldOn,
      category: parsed.category,
      year,
    });
  }

  return results;
}

/**
 * 詳細ページ HTML から kaigiroku/ 配下の PDF リンクを抽出する。
 * -total.pdf がある場合はそちらのみ返す（日ごとの全体版を優先）。
 * -total.pdf がない場合は個別の PDF を全て返す。
 */
export function parseDetailPage(
  html: string,
  baseUrl: string,
): string[] {
  const linkPattern = /href="([^"]*kaigiroku\/[^"]*\.pdf)"/gi;
  const allPdfs: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;

    // 絶対 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス: baseUrl (ディレクトリ) + href
      const basePath = baseUrl.replace(/\/[^/]*$/, "/");
      pdfUrl = `${basePath}${href}`;
    }

    if (!seen.has(pdfUrl)) {
      seen.add(pdfUrl);
      allPdfs.push(pdfUrl);
    }
  }

  // -total.pdf がある場合はそちらのみ返す
  const totalPdfs = allPdfs.filter((url) => url.includes("-total.pdf"));
  if (totalPdfs.length > 0) {
    return totalPdfs;
  }

  return allPdfs;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 *
 * 1. 一覧ページから全会議の詳細ページ URL を取得
 * 2. 指定年でフィルタ
 * 3. 各詳細ページから PDF リンクを収集
 */
export async function fetchMeetingList(
  year: number,
): Promise<EsashiMeeting[]> {
  const listHtml = await fetchShiftJisPage(LIST_PAGE_URL);
  if (!listHtml) return [];

  const allMeetings = parseListPage(listHtml);
  const filtered = allMeetings.filter((m) => m.year === year);

  const results: EsashiMeeting[] = [];

  for (const meeting of filtered) {
    const detailHtml = await fetchShiftJisPage(meeting.detailUrl);
    if (!detailHtml) continue;

    const pdfUrls = parseDetailPage(detailHtml, meeting.detailUrl);

    for (const pdfUrl of pdfUrls) {
      results.push({
        pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        category: meeting.category,
      });
    }
  }

  return results;
}
