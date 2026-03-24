/**
 * 河南町議会 -- list フェーズ
 *
 * 2段階クロールで PDF リンクを収集する:
 * 1. トップページから年度別一覧ページ URL を取得
 * 2. 各年度別ページから PDF リンクとメタ情報を抽出
 *
 * トップページ: /gyoseijoho/gikai/1/index.html
 *   → 年度別ページ: /gyoseijoho/gikai/1/{ページID}.html
 *     → PDF リンク: /material/files/group/{グループID}/{ファイル名}.pdf
 *
 * 予算・決算常任委員会: /gyoseijoho/gikai/1/{ページID}.html (令和5年・6年のみ)
 */

import {
  BASE_ORIGIN,
  BUDGET_PAGE_IDS,
  TOP_PAGE_PATH,
  fetchPage,
  toJapaneseEra,
} from "./shared";

export interface KananMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null; // YYYY-MM-DD、解析不能な場合は null
  section: string;
}

/**
 * トップページから年度別ページのリンクを抽出する。
 * パターン: /gyoseijoho/gikai/1/{ページID}.html
 */
export function parseTopPage(html: string): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // /gyoseijoho/gikai/1/{数字}.html のリンクを抽出（index.html は除く）
  const linkRegex =
    /<a[^>]+href="([^"]*\/gyoseijoho\/gikai\/1\/(\d+)\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[3]!.trim();

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    // 重複除去
    if (!results.some((r) => r.url === url)) {
      results.push({ label, url });
    }
  }

  return results;
}

/**
 * 和暦テキストから開催日 YYYY-MM-DD を返す。
 * 「令和6年12月定例会議会議録」→ "2024-12-01"（月のみ確定、日は 1 日）
 * リンクテキストからは日は取れないため月単位とする。
 */
export function parseMeetingDate(title: string): string | null {
  // 「令和X年Y月」パターン
  const reiwaMatch = title.match(/令和(元|\d+)年(\d+)月/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    const month = Number(reiwaMatch[2]);
    const westernYear = eraYear + 2018;
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  // 「平成X年Y月」パターン
  const heisei = title.match(/平成(元|\d+)年(\d+)月/);
  if (heisei) {
    const eraYear = heisei[1] === "元" ? 1 : Number(heisei[1]);
    const month = Number(heisei[2]);
    const westernYear = eraYear + 1988;
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 年度別一覧ページから PDF リンクを抽出する。
 *
 * HTML 構造例:
 *   <a href="//www.town.kanan.osaka.jp/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議会議録</a>
 *   <a href="/material/files/group/22/R0612_teireikaigi.pdf">令和6年12月定例会議会議録</a>
 */
export function parseYearPage(html: string): KananMeeting[] {
  const results: KananMeeting[] = [];

  const linkRegex =
    /<a[^>]+href="([^"]*\/material\/files\/group\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawLabel = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!rawLabel) continue;

    // プロトコル相対 URL (//www.town...) → https: を付与
    // 絶対 URL (https://) → そのまま
    // 相対 URL (/material/...) → BASE_ORIGIN を付与
    let pdfUrl: string;
    if (href.startsWith("//")) {
      pdfUrl = `https:${href}`;
    } else if (href.startsWith("http")) {
      pdfUrl = href;
    } else {
      pdfUrl = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    const heldOn = parseMeetingDate(rawLabel);

    // 重複除去
    if (!results.some((r) => r.pdfUrl === pdfUrl)) {
      results.push({
        pdfUrl,
        title: rawLabel,
        heldOn,
        section: rawLabel,
      });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 定例会議・臨時会議ページと予算・決算常任委員会ページの両方から収集する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number
): Promise<KananMeeting[]> {
  const eraTexts = toJapaneseEra(year);
  const allMeetings: KananMeeting[] = [];

  // --- 定例会議・臨時会議 ---
  const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (topHtml) {
    const yearPages = parseTopPage(topHtml);

    // 対象年に関連するページを特定
    const targetPage = yearPages.find((p) =>
      eraTexts.some((era) => p.label.includes(era))
    );
    if (targetPage) {
      const yearHtml = await fetchPage(targetPage.url);
      if (yearHtml) {
        allMeetings.push(...parseYearPage(yearHtml));
      }
    }
  }

  // --- 予算・決算常任委員会（令和5年・6年のみ） ---
  const budgetPageId = BUDGET_PAGE_IDS[year];
  if (budgetPageId) {
    await new Promise((r) => setTimeout(r, 1_000));
    const budgetUrl = `${BASE_ORIGIN}/gyoseijoho/gikai/1/${budgetPageId}.html`;
    const budgetHtml = await fetchPage(budgetUrl);
    if (budgetHtml) {
      const budgetMeetings = parseYearPage(budgetHtml);
      // 重複しないものだけ追加
      for (const m of budgetMeetings) {
        if (!allMeetings.some((a) => a.pdfUrl === m.pdfUrl)) {
          allMeetings.push(m);
        }
      }
    }
  }

  return allMeetings;
}
