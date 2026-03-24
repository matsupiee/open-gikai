/**
 * 浦河町議会 会議録 — list フェーズ
 *
 * 審議の結果トップ → 年度別カテゴリ → 会議種別カテゴリ → 詳細ページ → PDF リンク
 * の4段階クロールを行う。
 *
 * URL 構造:
 *   トップ: ?category=220
 *   年度別: ?category={年度ID}
 *   会議種別: ?category={会議種別ID}
 *   詳細: ?content={コンテンツID}
 *   PDF: /gyosei/assets/images/content/content_{タイムスタンプ}.pdf
 */

import {
  TOP_URL,
  buildCategoryUrl,
  buildContentUrl,
  eraToWesternYear,
  fetchPage,
  normalizePdfUrl,
  toHalfWidth,
} from "./shared";

export interface UrakawaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第8回浦河町議会定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary" / "committee"） */
  category: string;
  /** 外部 ID 用のキー（例: "016071_content3355_20241210_150000"） */
  pdfKey: string;
  /** 詳細ページのコンテンツ ID */
  contentId: string;
}

/**
 * トップカテゴリページから年度別カテゴリ ID を抽出する。
 *
 * リンクパターン: ?category={ID}
 * リンクテキスト: "20XX年（令和X年分）" 等
 */
export function parseTopPage(html: string): { categoryId: string; year: number }[] {
  const results: { categoryId: string; year: number }[] = [];

  // ?category={ID} のリンクを抽出（トップカテゴリ 220 は除外）
  const linkPattern = /href="[^"]*\?category=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const categoryId = match[1]!;
    if (categoryId === "220") continue; // トップカテゴリ自身はスキップ

    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 年度を抽出: "2024年（令和6年分）" → 2024
    const yearMatch = linkText.match(/(\d{4})年/);
    if (!yearMatch) continue;

    const year = parseInt(yearMatch[1]!, 10);
    if (year < 2000 || year > 2100) continue;

    results.push({ categoryId, year });
  }

  return results;
}

/**
 * 年度別カテゴリページから会議種別カテゴリ ID を抽出する。
 *
 * リンクテキスト: "本会議", "総務産業建設常任委員会", "厚生文教常任委員会" 等
 */
export function parseYearCategoryPage(html: string): { categoryId: string; typeName: string }[] {
  const results: { categoryId: string; typeName: string }[] = [];

  const linkPattern = /href="[^"]*\?category=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const categoryId = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 会議種別のキーワードを含むものだけ取得
    if (
      linkText.includes("本会議") ||
      linkText.includes("委員会") ||
      linkText.includes("議会")
    ) {
      if (!results.some((r) => r.categoryId === categoryId)) {
        results.push({ categoryId, typeName: linkText });
      }
    }
  }

  return results;
}

/**
 * 会議種別カテゴリページから詳細ページ（コンテンツ ID）を抽出する。
 *
 * リンクパターン: ?content={ID}
 */
export function parseMeetingTypePage(html: string): { contentId: string; title: string }[] {
  const results: { contentId: string; title: string }[] = [];

  const linkPattern = /href="[^"]*\?content=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const contentId = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!results.some((r) => r.contentId === contentId)) {
      results.push({ contentId, title: linkText });
    }
  }

  return results;
}

/**
 * 会議録詳細ページから PDF リンクと日付を抽出する。
 *
 * PDF URL パターン: ../../assets/images/content/content_{YYYYMMDD_HHMMSS}.pdf
 * リンクテキスト: "令和X年X月X日 [PDF｜XXX KB]"
 */
export function parseDetailPage(
  html: string,
  title: string,
  contentId: string,
  category: string,
): UrakawaMeeting[] {
  const results: UrakawaMeeting[] = [];

  // アンカータグ全体（リンクテキスト含む）で PDF リンクを抽出する
  const pdfLinkPattern =
    /<a[^>]+href="([^"]*assets\/images\/content\/content_(\d{8}_\d{6})\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkPattern)) {
    const pdfPath = match[1]!;
    const timestamp = match[2]!;
    const linkText = match[3]!.replace(/<[^>]+>/g, "").trim();

    const pdfUrl = normalizePdfUrl(pdfPath);

    // タイムスタンプから日付を抽出: YYYYMMDD_HHMMSS → YYYY-MM-DD
    const dateMatch = timestamp.match(/^(\d{4})(\d{2})(\d{2})_/);
    const heldOnFromTimestamp = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      : null;

    // リンクテキストから日付を解析（和暦）を優先する
    const heldOnFromText = parseDateFromText(linkText);
    const heldOn = heldOnFromText ?? heldOnFromTimestamp;

    const pdfKey = `016071_content${contentId}_${timestamp}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      category,
      pdfKey,
      contentId,
    });
  }

  return results;
}

/**
 * テキストから和暦の日付を抽出して YYYY-MM-DD 形式で返す。
 */
export function parseDateFromText(text: string): string | null {
  const halfWidth = toHalfWidth(text);
  const match = halfWidth.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(`${match[1]}${match[2]}年`);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<UrakawaMeeting[]> {
  // Step 1: トップページから年度別カテゴリを取得
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearCategories = parseTopPage(topHtml);

  // 指定年に一致するカテゴリを探す
  const targetCategories = yearCategories.filter((c) => c.year === year);
  if (targetCategories.length === 0) return [];

  const allMeetings: UrakawaMapping[] = [];

  for (const { categoryId } of targetCategories) {
    // Step 2: 年度別カテゴリページから会議種別を取得
    const yearCategoryUrl = buildCategoryUrl(categoryId);
    const yearHtml = await fetchPage(yearCategoryUrl);
    if (!yearHtml) continue;

    const meetingTypes = parseYearCategoryPage(yearHtml);

    for (const { categoryId: typeId, typeName } of meetingTypes) {
      // Step 3: 会議種別ページから詳細ページ（コンテンツ ID）を取得
      const typeUrl = buildCategoryUrl(typeId);
      const typeHtml = await fetchPage(typeUrl);
      if (!typeHtml) continue;

      const contentLinks = parseMeetingTypePage(typeHtml);

      const category = typeName.includes("委員会") ? "committee" : typeName.includes("臨時") ? "extraordinary" : "plenary";

      for (const { contentId, title } of contentLinks) {
        // Step 4: 詳細ページから PDF リンクを取得
        const contentUrl = buildContentUrl(contentId);
        const contentHtml = await fetchPage(contentUrl);
        if (!contentHtml) continue;

        const meetings = parseDetailPage(contentHtml, title, contentId, category);
        allMeetings.push(...meetings);
      }
    }
  }

  return allMeetings;
}

// 型エイリアス（型エラー回避用）
type UrakawaMapping = UrakawaMeeting;
