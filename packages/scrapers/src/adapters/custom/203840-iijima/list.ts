/**
 * 飯島町議会 — list フェーズ
 *
 * 全年度・全会議の PDF リンクが 1 ページに集約されている。
 * h2 で年度セクション、h3 で定例会/臨時会を分け、
 * p.file-link-item > a.pdf で PDF リンクを掲載。
 *
 * リンクテキスト例:
 *   "令和7年3月議会定例会 (PDFファイル: 2.4MB)"
 *   "令和7年第1回臨時会 (PDFファイル: 440.7KB)"
 */

import { BASE_ORIGIN, LIST_URL, eraToWesternYear, fetchPage } from "./shared";

export interface IijimaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * リンクテキストから会議名と年月を抽出する。
 *
 * 定例会: "令和7年3月議会定例会 (PDFファイル: 2.4MB)"
 *   → { title: "令和7年3月議会定例会", year: 2025, month: 3, section: "定例会" }
 *
 * 臨時会: "令和7年第1回臨時会 (PDFファイル: 440.7KB)"
 *   → { title: "令和7年第1回臨時会", year: 2025, month: null, section: "臨時会" }
 */
export function parseLinkText(linkText: string): {
  title: string;
  year: number;
  month: number | null;
  section: string;
} | null {
  // ファイルサイズ情報を除去
  const title = linkText.replace(/\s*\(PDFファイル[^)]*\)\s*$/, "").trim();
  if (!title) return null;

  // 定例会パターン: "令和7年3月議会定例会" or "平成17年12月議会定例会"
  const teireikai = title.match(/^(令和|平成)(元|\d+)年(\d+)月議会定例会/);
  if (teireikai) {
    const westernYear = eraToWesternYear(teireikai[1]!, teireikai[2]!);
    if (!westernYear) return null;
    return {
      title,
      year: westernYear,
      month: Number(teireikai[3]),
      section: "定例会",
    };
  }

  // 臨時会パターン: "令和7年第1回臨時会"
  const rinjiPattern = title.match(/^(令和|平成)(元|\d+)年第(\d+)回臨時会/);
  if (rinjiPattern) {
    const westernYear = eraToWesternYear(rinjiPattern[1]!, rinjiPattern[2]!);
    if (!westernYear) return null;
    return {
      title,
      year: westernYear,
      month: null,
      section: "臨時会",
    };
  }

  return null;
}

/**
 * h2 見出しから西暦年を抽出する。
 * e.g., "令和7年議会議事録" → 2025
 */
export function parseH2Year(heading: string): number | null {
  const match = heading.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 年と月から YYYY-MM-01 形式の heldOn を生成する。
 * 月が不明な場合は年の 01-01 を使う。
 */
function buildHeldOn(year: number, month: number | null): string {
  const m = month ? String(month).padStart(2, "0") : "01";
  return `${year}-${m}-01`;
}

/**
 * 一覧ページの HTML をパースして PDF リンク一覧を返す（テスト可能な純粋関数）。
 */
export function parseListPage(html: string): IijimaMeeting[] {
  const results: IijimaMeeting[] = [];

  // h2 見出しの位置と年を収集
  const h2Pattern =
    /<h2[^>]*>(?:<[^>]+>)*(.*?)(?:<\/[^>]+>)*<\/h2>/g;
  const h2Sections: { index: number; year: number }[] = [];
  for (const match of html.matchAll(h2Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    const year = parseH2Year(text);
    if (year) {
      h2Sections.push({ index: match.index!, year });
    }
  }

  // h3 見出しの位置とセクション名を収集
  const h3Pattern =
    /<h3[^>]*>(?:<[^>]+>)*(.*?)(?:<\/[^>]+>)*<\/h3>/g;
  const h3Sections: { index: number; name: string }[] = [];
  for (const match of html.matchAll(h3Pattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text.includes("定例会") || text.includes("臨時会")) {
      h3Sections.push({ index: match.index!, name: text.replace(/議事録$/, "").trim() });
    }
  }

  // PDF リンクを抽出
  const linkPattern =
    /<a[^>]+class="pdf"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // PDF URL を構築（プロトコル相対パスに対応）
    let pdfUrl: string;
    if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    // リンクテキストからメタ情報を抽出
    const parsed = parseLinkText(linkText);
    if (parsed) {
      results.push({
        pdfUrl,
        title: parsed.title,
        heldOn: buildHeldOn(parsed.year, parsed.month),
        section: parsed.section,
      });
      continue;
    }

    // リンクテキストでパースできない場合、h2/h3 のコンテキストから推定
    const currentH2 = h2Sections.filter((s) => s.index < linkIndex).pop();
    const currentH3 = h3Sections.filter((s) => s.index < linkIndex).pop();

    if (currentH2) {
      const section = currentH3?.name ?? "定例会";
      const cleanTitle = linkText.replace(/\s*\(PDFファイル[^)]*\)\s*$/, "").trim();
      results.push({
        pdfUrl,
        title: cleanTitle || `${currentH2.year}年 ${section}`,
        heldOn: buildHeldOn(currentH2.year, null),
        section,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF リンクのみを返す。
 */
export function filterByYear(
  meetings: IijimaMeeting[],
  year: number
): IijimaMeeting[] {
  return meetings.filter((m) => m.heldOn.startsWith(`${year}-`));
}

/**
 * 一覧ページを取得して指定年のミーティング一覧を返す。
 */
export async function fetchMeetingList(
  year: number
): Promise<IijimaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);
  return filterByYear(all, year);
}
