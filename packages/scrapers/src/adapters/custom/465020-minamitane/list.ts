/**
 * 南種子町議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ（minutes.html）から PDF リンクとメタ情報を収集する。
 *
 * ページ構造:
 *   <h3>令和7年</h3>
 *   <table>
 *     ...
 *     <p>第3回定例会（<a href="assets/files/pdf/gikai/R07dai3kaiteireikaikaigiroku.pdf">PDF</a>）</p>
 *     <p>第4回臨時会（<a href="assets/files/pdf/gikai/R7dai4kairinjikaikaigiroku.pdf">PDF</a>）</p>
 *   </table>
 *
 * - 年度は直前の <h3> テキストから取得
 * - PDF リンクのない（未掲載）エントリはスキップ
 * - 全年度が単一ページに掲載されているため、ページネーション不要
 */

import { BASE_ORIGIN, LIST_PAGE_URL, fetchPage, detectMeetingType, parseEraYear } from "./shared";

export interface MinamitaneMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第3回定例会"） */
  title: string;
  /** 西暦年（例: 2024）。解析できない場合は null */
  year: number | null;
  /** 会議タイプ */
  meetingType: string;
}

/**
 * 会議録一覧ページの HTML から PDF リンクとメタ情報を抽出する。
 *
 * <h3> で年度を検出し、直後の <table> 内の <p> タグ内の PDF リンクを収集する。
 */
export function parseListPage(html: string): MinamitaneMeeting[] {
  const results: MinamitaneMeeting[] = [];

  // <h3> タグと assets/files/pdf/gikai/ を含む <a> タグを対象にパース
  // h3 から現在の年度を追跡しながら順番に処理する
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;

  // h3 と p タグの出現位置を収集
  interface TagEntry {
    type: "h3" | "p";
    index: number;
    content: string;
  }

  const entries: TagEntry[] = [];

  for (const m of html.matchAll(h3Pattern)) {
    entries.push({
      type: "h3",
      index: m.index!,
      content: m[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  for (const m of html.matchAll(pPattern)) {
    entries.push({
      type: "p",
      index: m.index!,
      content: m[1]!,
    });
  }

  // 出現順にソート
  entries.sort((a, b) => a.index - b.index);

  let currentYear: number | null = null;

  for (const entry of entries) {
    if (entry.type === "h3") {
      currentYear = parseEraYear(entry.content);
      continue;
    }

    // p タグ: PDF リンクを探す
    const pContent = entry.content;
    const linkMatch = pContent.match(/href="([^"]*assets\/files\/pdf\/gikai\/[^"]+\.pdf)"/i);
    if (!linkMatch) continue;

    const href = linkMatch[1]!;
    const pdfUrl = href.startsWith("http")
      ? href
      : new URL(href, `${BASE_ORIGIN}/`).toString();

    // <p> テキストから会議タイトルを抽出（タグを除去）
    const rawText = pContent
      .replace(/<[^>]+>/g, "")
      .replace(/[（(][^）)]*[）)]/g, "")
      .trim();

    const titleMatch = rawText.match(/第\d+回(?:定例会|臨時会|特別会)/);
    const title = titleMatch ? titleMatch[0] : rawText.trim();

    results.push({
      pdfUrl,
      title,
      year: currentYear,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

/**
 * 会議録一覧ページから全 PDF リンクを取得し、指定年でフィルタする。
 */
export async function fetchDocumentList(year: number): Promise<MinamitaneMeeting[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) {
    console.warn(`[465020-minamitane] Failed to fetch list page: ${LIST_PAGE_URL}`);
    return [];
  }

  const all = parseListPage(html);
  return all.filter((m) => m.year === year);
}
