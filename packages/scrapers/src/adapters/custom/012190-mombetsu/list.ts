/**
 * 紋別市議会 — list フェーズ
 *
 * カテゴリツリーを辿って全 content ページの PDF リンクを収集する。
 *
 * URL 構造:
 *   トップ → ?category={種別ID}（定例会/臨時会/委員会/特別委員会）
 *          → ?category={年度ID}（令和6年 等）
 *          → ?content={contentID}（第4回定例会 等）
 *          → PDF リンク一覧
 *
 * content ページ構造:
 *   - 会議名テキスト（例: "令和6年第4回紋別市議会定例会"）
 *   - 開催日（例: "12月3日", "12月9日"）
 *   - PDF リンク: href="../../assets/images/content/content_*.pdf"
 */

import {
  BASE_ORIGIN,
  BASE_URL,
  MEETING_TYPE_CATEGORIES,
  eraToWesternYear,
  normalizeNumbers,
  fetchPage,
  stripHtml,
} from "./shared";

export interface MombetsuMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第4回紋別市議会定例会 12月3日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string | null;
  /** 会議種別カテゴリ（例: "定例会"） */
  meetingTypeLabel: string;
  /** content ページの URL */
  contentUrl: string;
}

/**
 * 種別カテゴリページ（?category={種別ID}）から年度別サブカテゴリ ID を抽出する（純粋関数）。
 *
 * e.g., `./?category=208` のリンクから ["208", "196", ...] を返す。
 * 年度ラベルとカテゴリ ID のペアを返す。
 */
export function parseYearCategories(
  html: string,
): { categoryId: string; yearLabel: string }[] {
  const results: { categoryId: string; yearLabel: string }[] = [];

  const linkPattern =
    /<a[^>]+href="[^"]*[?&]category=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const categoryId = match[1]!;
    const labelHtml = match[2]!;
    const label = stripHtml(labelHtml).trim();

    // 年度ラベルであることを確認（令和/平成を含む）
    if (!label.match(/令和|平成/)) continue;

    results.push({ categoryId, yearLabel: label });
  }

  return results;
}

/**
 * 年度カテゴリページ（?category={年度ID}）から content ID を抽出する（純粋関数）。
 *
 * e.g., `./?content=3509` のリンクから ["3509", "3304", ...] を返す。
 */
export function parseContentIds(
  html: string,
): { contentId: string; label: string }[] {
  const results: { contentId: string; label: string }[] = [];

  const linkPattern =
    /<a[^>]+href="[^"]*[?&]content=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const contentId = match[1]!;
    const label = stripHtml(match[2]!).trim();

    // content ID が実際の会議録（行政視察等を除く）であることを確認
    if (!label) continue;

    results.push({ contentId, label });
  }

  return results;
}

/**
 * content ページ（?content={contentID}）から PDF リンクと開催日を抽出する（純粋関数）。
 *
 * PDF URL パターン: ../../assets/images/content/content_*.pdf
 * 各 PDF リンクの近くに開催日テキスト（"12月3日" 等）がある。
 * ページタイトルから西暦年を取得して開催日を YYYY-MM-DD に変換する。
 */
export function parseContentPage(
  html: string,
  meetingTypeLabel: string,
  contentUrl: string,
): MombetsuMeeting[] {
  const results: MombetsuMeeting[] = [];

  // ページタイトル/見出しから会議名を取得（h1, h2, strong 等）
  let meetingName = "";
  const titlePatterns = [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    /<h2[^>]*>([\s\S]*?)<\/h2>/i,
    /<strong[^>]*>([\s\S]*?)<\/strong>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ];
  for (const pattern of titlePatterns) {
    const m = html.match(pattern);
    if (m) {
      const text = stripHtml(m[1]!).trim();
      // 和暦年と「会」を含むもの
      if (text.match(/令和|平成/) && text.includes("会")) {
        meetingName = text;
        break;
      }
    }
  }

  // 年度を取得（会議名から）
  let westernYear: number | null = null;
  if (meetingName) {
    westernYear = eraToWesternYear(meetingName);
  }

  // PDF リンクと周辺テキストを収集
  // href パターン: ../../assets/images/content/content_*.pdf
  const pdfPattern =
    /<a[^>]+href="([^"]*assets\/images\/content\/content_[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const linkText = stripHtml(match[2]!).trim();
    const linkIndex = match.index!;

    // PDF の完全 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("../../")) {
      // ../../assets/images/content/xxx.pdf → https://mombetsu.jp/assets/images/content/xxx.pdf
      const relPath = href.replace(/^\.\.\/\.\./, "");
      pdfUrl = `${BASE_ORIGIN}${relPath}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // 開催日をリンクテキストまたは同一 <li> 内のテキストから抽出
    // "12月3日", "8月27日" 等
    const linkNormalized = normalizeNumbers(linkText);

    // まずリンクテキストから試みる
    let dateMatch = linkNormalized.match(/(\d+)月(\d+)日/);

    // なければ、このリンクを含む <li> タグ内のテキストから試みる
    if (!dateMatch) {
      // リンク位置より前で直近の <li> 開始位置を探す
      const htmlBeforeLink = html.slice(0, linkIndex);
      const liStart = htmlBeforeLink.lastIndexOf("<li");
      if (liStart !== -1) {
        // <li> の終わりを探す（次の </li> まで）
        const liEnd = html.indexOf("</li>", linkIndex);
        const liContent = liEnd !== -1
          ? html.slice(liStart, liEnd)
          : html.slice(liStart, linkIndex + match[0].length + 50);
        const liText = normalizeNumbers(stripHtml(liContent));
        dateMatch = liText.match(/(\d+)月(\d+)日/);
      }
    }

    let heldOn: string | null = null;
    if (dateMatch && westernYear) {
      const month = parseInt(dateMatch[1]!, 10);
      const day = parseInt(dateMatch[2]!, 10);
      heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // タイトルを構築
    const dateStr = dateMatch ? dateMatch[0] : "";
    const title = meetingName
      ? `${meetingName}${dateStr ? ` ${dateStr}` : ""}`
      : linkText;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingTypeLabel,
      contentUrl,
    });
  }

  return results;
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 *
 * 1. 各会議種別カテゴリページから年度別サブカテゴリを取得
 * 2. 対象年度のカテゴリページから content ID を取得
 * 3. 各 content ページから PDF リンクを取得
 */
export async function fetchMeetingList(
  year: number,
): Promise<MombetsuMeeting[]> {
  const allMeetings: MombetsuMeeting[] = [];

  for (const { categoryId, label: meetingTypeLabel } of MEETING_TYPE_CATEGORIES) {
    const typePageUrl = `${BASE_URL}?category=${categoryId}`;
    const typePageHtml = await fetchPage(typePageUrl);
    if (!typePageHtml) continue;

    const yearCategories = parseYearCategories(typePageHtml);

    // 対象年のカテゴリを探す
    const targetYearCats = yearCategories.filter(({ yearLabel }) => {
      const y = eraToWesternYear(yearLabel);
      return y === year;
    });

    for (const { categoryId: yearCatId } of targetYearCats) {
      const yearPageUrl = `${BASE_URL}?category=${yearCatId}`;
      const yearPageHtml = await fetchPage(yearPageUrl);
      if (!yearPageHtml) continue;

      const contentItems = parseContentIds(yearPageHtml);

      for (const { contentId } of contentItems) {
        const contentUrl = `${BASE_URL}?content=${contentId}`;
        const contentHtml = await fetchPage(contentUrl);
        if (!contentHtml) continue;

        const meetings = parseContentPage(contentHtml, meetingTypeLabel, contentUrl);
        allMeetings.push(...meetings);
      }
    }
  }

  // 対象年でフィルタ（heldOn が取れているものは正確にフィルタ、null は通す）
  return allMeetings.filter((m) => {
    if (!m.heldOn) return true;
    const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
    return meetingYear === year;
  });
}
