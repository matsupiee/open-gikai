/**
 * 若桜町議会 会議録 -- list フェーズ
 *
 * 単一ページ（524.html）から全 PDF リンクとメタ情報を収集する。
 *
 * HTML 構造:
 *   <div class="free-layout-area">
 *     <div>
 *       <h2><span class="bg"><span class="bg2"><span class="bg3">令和7年12月定例会</span></span></span></h2>
 *       <p class="file-link-item"><a class="pdf" href="//www.town.wakasa.tottori.jp/material/files/group/2/20251223008.pdf">12月2日 (PDFファイル: 554.2KB)</a></p>
 *       ...
 *     </div>
 *   </div>
 *
 * 各 <h2> 内の会議名と、その後に続く <p class="file-link-item"> から
 * PDF URL・開催日を紐付けて収集する。
 */

import { LIST_URL, detectMeetingType, extractWesternYear, toHalfWidth, fetchPage } from "./shared";

export interface WakasaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年12月定例会 12月2日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（plenary / extraordinary） */
  meetingType: string;
  /** セッション名（例: "令和7年12月定例会"） */
  sessionTitle: string;
}

/**
 * リンクテキスト（例: "12月2日 (PDFファイル: 554.2KB)"）から
 * 月・日を抽出して開催日 YYYY-MM-DD を返す。
 * 年は会議名から取得するので month/day のみ返す。
 */
export function extractMonthDay(
  linkText: string,
): { month: number; day: number } | null {
  const normalized = toHalfWidth(linkText);
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;
  return {
    month: parseInt(match[1]!, 10),
    day: parseInt(match[2]!, 10),
  };
}

/**
 * 会議名テキスト（例: "令和7年12月定例会"）から
 * 開催年と月を推定する。
 * 日は PDF リンクテキストから取得するため、ここでは年のみ。
 */
export function extractSessionYear(sessionTitle: string): number | null {
  return extractWesternYear(sessionTitle);
}

/**
 * 会議名と PDF リンクテキストから開催日 YYYY-MM-DD を生成する。
 *
 * 平成30年7月臨時会 + "7月5日" → 2018-07-05
 * 令和7年12月定例会 + "12月2日" → 2025-12-02
 *
 * 会議名の年月と PDF テキストの月が一致するか確認して調整する。
 * 3月定例会で翌月（4月）まで会議が続く場合は年をそのまま使う。
 */
export function buildHeldOn(
  sessionTitle: string,
  linkText: string,
): string | null {
  const year = extractSessionYear(sessionTitle);
  if (year === null) return null;

  const monthDay = extractMonthDay(linkText);
  if (!monthDay) return null;

  return `${year}-${String(monthDay.month).padStart(2, "0")}-${String(monthDay.day).padStart(2, "0")}`;
}

/**
 * 一覧ページ HTML から会議録情報を解析する。
 *
 * <h2> 要素で会議種別を区切り、
 * 直後の <p class="file-link-item"> 内の PDF リンクを収集する。
 */
export function parseListPage(html: string): WakasaMeeting[] {
  const meetings: WakasaMeeting[] = [];

  // .free-layout-area 内の div を対象に解析
  // h2 タグからセッション名を取得し、以降の file-link-item を収集する

  // まず h2 とその位置を全て取得
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches = [...html.matchAll(h2Pattern)];

  if (h2Matches.length === 0) return meetings;

  for (let i = 0; i < h2Matches.length; i++) {
    const h2Match = h2Matches[i]!;
    // h2 内のタグを除去してセッション名を取得
    const sessionTitle = h2Match[1]!.replace(/<[^>]+>/g, "").trim();

    // このセクションの範囲（次の h2 まで）
    const startIdx = h2Match.index! + h2Match[0].length;
    const endIdx =
      i + 1 < h2Matches.length ? h2Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    // PDF リンクを収集（file-link-item > a.pdf）
    const pdfPattern =
      /<p[^>]*class="file-link-item"[^>]*>[\s\S]*?<a[^>]*class="pdf"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const pdfMatch of sectionHtml.matchAll(pdfPattern)) {
      let href = pdfMatch[1]!;
      const linkText = pdfMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // プロトコル相対 URL を絶対 URL に変換
      if (href.startsWith("//")) {
        href = `https:${href}`;
      } else if (!href.startsWith("http")) {
        href = `https://www.town.wakasa.tottori.jp${href.startsWith("/") ? "" : "/"}${href}`;
      }

      const heldOn = buildHeldOn(sessionTitle, linkText);
      if (!heldOn) continue;

      const meetingType = detectMeetingType(sessionTitle);
      const title = `${sessionTitle} ${linkText.replace(/\s*\(.*?\)\s*$/, "").trim()}`;

      meetings.push({
        pdfUrl: href,
        title,
        heldOn,
        meetingType,
        sessionTitle,
      });
    }
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<WakasaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);

  // 指定年でフィルタリング
  return allMeetings.filter((m) => {
    const meetingYear = extractSessionYear(m.sessionTitle);
    return meetingYear === year;
  });
}
