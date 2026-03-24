/**
 * 本部町議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ（単一ページ）から DOCX/PDF リンクとメタ情報を収集する。
 *
 * ページ構造:
 *   <h2>令和7年</h2>
 *   <p><a href="file_contents/361R7.docx">3月6日（第1号）R7</a></p>
 *   <p><a href="file_contents/2R7.docx">第2回定例会（会期日程・議決の結果）R7</a></p>
 *
 * - 年度は直前の <h2> テキストから取得
 * - 「会期日程・議決の結果」「目次・通告書」のファイルはスキップ
 * - file_contents/ を含む href のみ対象
 * - 全年度が単一ページに掲載されているため、ページネーション不要
 */

import { LIST_PAGE_URL, fetchPage, detectMeetingType, parseEraYear } from "./shared";

export interface MotubuMeeting {
  /** ファイルの完全 URL */
  fileUrl: string;
  /** ファイル種別 */
  fileType: "pdf" | "docx";
  /** 会議タイトル（リンクテキスト） */
  title: string;
  /** 西暦年（例: 2024）。解析できない場合は null */
  year: number | null;
  /** 開催日（YYYY-MM-DD 形式）。解析できない場合は null */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
}

/** スキップ対象のリンクテキストパターン */
const SKIP_PATTERNS = [/会期日程/, /議決の結果/, /目次/, /通告書/];

/**
 * リンクテキストから日付を抽出する。
 *
 * パターン:
 *   - "3月6日（第1号）R7" → 年は h2 から取得
 *   - "令和7年3月25日（3回臨）" → 年も含む
 * 返り値: "MM-DD" 形式（年は引数で補完）または null
 */
function extractDateFromTitle(
  title: string,
  year: number | null,
): string | null {
  if (!year) return null;

  // 「令和X年M月D日」パターン
  const fullDateMatch = title.match(/(?:令和|平成)\d+年(\d+)月(\d+)日/);
  if (fullDateMatch) {
    const month = fullDateMatch[1]!.padStart(2, "0");
    const day = fullDateMatch[2]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // 「M月D日」パターン
  const shortDateMatch = title.match(/(\d+)月(\d+)日/);
  if (shortDateMatch) {
    const month = shortDateMatch[1]!.padStart(2, "0");
    const day = shortDateMatch[2]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
}

/**
 * 会議録一覧ページの HTML から DOCX/PDF リンクとメタ情報を抽出する（純粋関数）。
 *
 * <h2> で年度を検出し、直後の <a href*="file_contents/"> からファイル URL と
 * リンクテキストを収集する。
 */
export function parseListPage(html: string): MotubuMeeting[] {
  const results: MotubuMeeting[] = [];

  interface TagEntry {
    type: "h2" | "a";
    index: number;
    content: string;
    href?: string;
  }

  const entries: TagEntry[] = [];

  // <h2> タグを収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  for (const m of html.matchAll(h2Pattern)) {
    entries.push({
      type: "h2",
      index: m.index!,
      content: m[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // file_contents/ を含む <a> タグを収集
  const aPattern = /<a[^>]+href="([^"]*file_contents\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(aPattern)) {
    entries.push({
      type: "a",
      index: m.index!,
      href: m[1]!,
      content: m[2]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // 出現順にソート
  entries.sort((a, b) => a.index - b.index);

  let currentYear: number | null = null;

  for (const entry of entries) {
    if (entry.type === "h2") {
      currentYear = parseEraYear(entry.content);
      continue;
    }

    const href = entry.href!;
    const title = entry.content;

    // スキップ対象を除外
    if (SKIP_PATTERNS.some((p) => p.test(title))) continue;

    // ファイル種別を判定
    const lowerHref = href.toLowerCase();
    let fileType: "pdf" | "docx";
    if (lowerHref.endsWith(".pdf")) {
      fileType = "pdf";
    } else if (lowerHref.endsWith(".docx")) {
      fileType = "docx";
    } else {
      continue; // 対象外
    }

    // URL を絶対パスに変換
    const fileUrl = href.startsWith("http")
      ? href
      : new URL(href, LIST_PAGE_URL).toString();

    const heldOn = extractDateFromTitle(title, currentYear);

    results.push({
      fileUrl,
      fileType,
      title,
      year: currentYear,
      heldOn,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

/**
 * 会議録一覧ページから全ファイルリンクを取得し、指定年でフィルタする。
 */
export async function fetchDocumentList(year: number): Promise<MotubuMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) {
    console.warn(`[473081-motobu] Failed to fetch list page: ${LIST_PAGE_URL}`);
    return [];
  }

  const all = parseListPage(html);
  return all.filter((m) => m.year === year);
}
