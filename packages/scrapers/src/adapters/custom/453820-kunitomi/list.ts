/**
 * 国富町議会 — list フェーズ
 *
 * 単一の会議録一覧ページから PDF リンクを収集する。
 *
 * HTML 構造:
 *   <h2>令和N年会議録</h2>
 *     <h3>令和N年第X回定例会</h3>
 *       <p><a href="...pdf">令和N年第X回定例会（M月　目次）.pdf</a></p>
 *       <p><a href="...pdf">令和N年第X回定例会（M月D日）.pdf</a></p>
 *
 * - 目次 PDF（リンクテキストに「目次」を含む）はスキップする
 * - 全角・半角数字が混在するため正規化が必要
 */

import { BASE_ORIGIN, eraToWesternYear, fetchPage, normalizeFullWidth } from "./shared";

export interface KunitomiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingKind: string;
}

/**
 * リンクテキストから会議情報を解析する。
 *
 * テキスト例:
 *   "令和7年第1回定例会（2月　目次）.pdf" → null (目次)
 *   "令和7年第1回定例会（2月14日）.pdf" → { year: 2025, session: 1, kind: "定例会", month: 2, day: 14 }
 *   "平成30年第3回定例会（12月7日）.pdf" → { year: 2018, session: 3, kind: "定例会", month: 12, day: 7 }
 */
export function parseLinkText(text: string): {
  year: number;
  session: number;
  meetingKind: string;
  month: number;
  day: number;
} | null {
  // 目次はスキップ
  if (text.includes("目次")) return null;

  // 会議情報を抽出: "令和N年第X回定例会" or "平成N年第X回臨時会"
  // 全角・半角数字が混在するため両方マッチさせる
  const sessionMatch = text.match(
    /(令和|平成)(元|[\d０-９]+)年第([\d０-９]+)回(定例会|臨時会)/
  );
  if (!sessionMatch) return null;

  const era = sessionMatch[1]!;
  const yearStr = sessionMatch[2]!;
  const session = parseInt(normalizeFullWidth(sessionMatch[3]!), 10);
  const meetingKind = sessionMatch[4]!;

  const year = eraToWesternYear(era, yearStr);

  // 日付を抽出: "（M月D日）" 全角・半角混在
  const dateMatch = text.match(/（(\d+|[０-９]+)月(\d+|[０-９]+)日）/);
  if (!dateMatch) return null;

  const month = parseInt(normalizeFullWidth(dateMatch[1]!), 10);
  const day = parseInt(normalizeFullWidth(dateMatch[2]!), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, session, meetingKind, month, day };
}

/**
 * 会議録一覧ページの HTML から PDF リンクを抽出する。
 *
 * - 目次 PDF はスキップ
 * - 指定年の PDF のみ抽出
 * - 隣接する同一 href の <a> タグを結合したテキストを扱う
 */
export function parseListPage(html: string, year: number): KunitomiMeeting[] {
  const results: KunitomiMeeting[] = [];

  // PDF リンクを抽出: href="...pdf" のリンクテキストと URL
  // 注: リンクテキストが分割されている場合があるため、同一 href の連続リンクを結合
  const linkRegex = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  const hrefTextMap = new Map<string, string>();

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawText = match[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 同一 href のテキストを結合（分割された a タグ対応）
    const existing = hrefTextMap.get(href) ?? "";
    hrefTextMap.set(href, existing + rawText);
  }

  for (const [href, linkText] of hrefTextMap) {
    const info = parseLinkText(linkText);
    if (!info) continue;

    // 対象年のみ抽出
    if (info.year !== year) continue;

    // PDF の絶対 URL を構築
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("//")) {
      pdfUrl = `http:${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    const heldOn = `${info.year}-${String(info.month).padStart(2, "0")}-${String(info.day).padStart(2, "0")}`;

    // タイトルを生成 (例: "令和7年第1回定例会（2月14日）")
    let eraTitle: string;
    if (info.year >= 2019) {
      const rYear = info.year - 2018;
      eraTitle = rYear === 1 ? "令和元年" : `令和${rYear}年`;
    } else if (info.year >= 1989) {
      const hYear = info.year - 1988;
      eraTitle = hYear === 1 ? "平成元年" : `平成${hYear}年`;
    } else {
      eraTitle = `${info.year}年`;
    }
    const title = `${eraTitle}第${info.session}回${info.meetingKind}（${info.month}月${info.day}日）`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingKind: info.meetingKind,
    });
  }

  // heldOn でソート
  results.sort((a, b) => a.heldOn.localeCompare(b.heldOn));

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<KunitomiMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, year);
}
