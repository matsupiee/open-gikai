/**
 * 知内町議会（北海道） — list フェーズ
 *
 * 2 段階クロールで PDF リンクを収集する:
 *   1. 会議録トップページから年度別ページへのリンクを抽出
 *   2. 各年度ページのテーブルから会議録 PDF リンクと開催日を抽出
 *
 * 年号コードと西暦年の対応:
 *   h24=2012, h25=2013, ..., h31=2019, r01=2019, r02=2020, ..., r07=2025
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  eraCodeToYear,
  parseHeldOn,
  detectMeetingType,
  fetchPage,
  delay,
} from "./shared";

export interface ShiriuchiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第1回定例会 1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD（テーブルから取得できた場合。取得できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 開催年（西暦） */
  year: number;
}

const INTER_REQUEST_DELAY_MS = 1500;

/** 絶対 URL を組み立てる */
function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  return `${BASE_ORIGIN}${href.startsWith("/") ? href : `/${href}`}`;
}

/**
 * 会議録トップページ HTML から年度別ページへのリンクを抽出する。
 *
 * パターン: /chosei/gikai/kaigiroku/{年号コード}/
 * 年号コード: h24, h25, ..., h31, r01, r02, ..., r07
 */
export function parseTopPage(
  html: string,
): { url: string; eraCode: string; year: number }[] {
  const results: { url: string; eraCode: string; year: number }[] = [];
  const seen = new Set<string>();

  const linkPattern =
    /href="(\/chosei\/gikai\/kaigiroku\/(h\d+|r\d+)\/?)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const eraCode = match[2]!.toLowerCase();

    if (seen.has(eraCode)) continue;
    seen.add(eraCode);

    const year = eraCodeToYear(eraCode);
    if (!year) continue;

    const url = toAbsoluteUrl(href.endsWith("/") ? href : `${href}/`);
    results.push({ url, eraCode, year });
  }

  return results;
}

/**
 * 年度ページの HTML からテーブル内の会議録 PDF リンクと開催日を抽出する。
 *
 * テーブル構造:
 *   <tr>
 *     <td>開会日（例: 令和6年3月4日）</td>
 *     <td>区分（1日目、2日目など）</td>
 *     <td><a href="...pdf">議案</a></td>
 *     <td><a href="...pdf">会議録</a></td>
 *     <td><a href="...pdf">審議結果</a></td>
 *     <td>動画リンクなど</td>
 *   </tr>
 *
 * 各テーブルの直前に会議種別（定例会/臨時会/特別委員会）の見出しがある。
 */
export function parseYearPage(
  html: string,
): { pdfUrl: string; title: string; heldOn: string | null }[] {
  const results: { pdfUrl: string; title: string; heldOn: string | null }[] =
    [];

  // 見出し + テーブルのブロックに分割して処理
  const blocks = splitByHeadingsAndTables(html);

  for (const block of blocks) {
    const meetingName = block.heading;
    const tableHtml = block.tableHtml;

    if (!tableHtml) continue;

    // テーブル内の行を解析
    const rows = extractTableRows(tableHtml);

    let currentHeldOn: string | null = null;

    for (const row of rows) {
      // 開会日セルから日付を抽出
      const dateMatch = row.match(
        /(令和|平成)(元|\d+)年\s*\d{1,2}月\s*\d{1,2}日/,
      );
      if (dateMatch) {
        currentHeldOn = parseHeldOn(dateMatch[0]);
      }

      // 会議録 PDF リンクを抽出（.pdf で終わる href）
      const pdfPattern = /href="([^"]+\.pdf)"/gi;
      for (const pdfMatch of row.matchAll(pdfPattern)) {
        const href = pdfMatch[1]!;
        const pdfUrl = toAbsoluteUrl(href);

        // リンクテキストを抽出
        const linkTextMatch = pdfMatch[0]
          ? row
              .substring(row.indexOf(pdfMatch[0]))
              .match(/href="[^"]+"[^>]*>([\s\S]*?)<\/a>/)
          : null;
        const rawLinkText = linkTextMatch?.[1]
          ? linkTextMatch[1]
              .replace(/<[^>]+>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .trim()
          : "";

        // 会議録 PDF のみを対象とする（議案・審議結果も取得するが、会議録を優先）
        // href が .pdf であれば会議録として扱う
        const title = buildTitle(meetingName, rawLinkText);

        results.push({
          pdfUrl,
          title,
          heldOn: currentHeldOn,
        });
      }
    }
  }

  return results;
}

/**
 * HTML を見出し + テーブルのブロックに分割する。
 */
function splitByHeadingsAndTables(
  html: string,
): { heading: string; tableHtml: string | null }[] {
  const blocks: { heading: string; tableHtml: string | null }[] = [];

  // 見出しタグとテーブルタグを順番に処理
  const combinedPattern =
    /<(h[1-6]|table)[^>]*>([\s\S]*?)<\/\1>/gi;

  let currentHeading = "会議録";

  const matches = [...html.matchAll(combinedPattern)];

  for (const match of matches) {
    const tagName = match[1]!.toLowerCase();
    const content = match[2]!;

    if (tagName.startsWith("h")) {
      // 見出しテキストを更新
      currentHeading = content.replace(/<[^>]+>/g, "").trim();
    } else if (tagName === "table") {
      blocks.push({
        heading: currentHeading,
        tableHtml: match[0],
      });
    }
  }

  return blocks;
}

/**
 * テーブル HTML から行（<tr>...</tr>）を抽出する。
 */
function extractTableRows(tableHtml: string): string[] {
  const rows: string[] = [];
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const match of tableHtml.matchAll(rowPattern)) {
    rows.push(match[0]);
  }

  return rows;
}

/**
 * 会議名とリンクテキストから表示タイトルを組み立てる。
 */
function buildTitle(
  meetingName: string,
  linkText: string,
): string {
  // 会議名が有意なものかチェック
  const baseName =
    meetingName && meetingName !== "会議録" ? meetingName : "会議録";

  // リンクテキストが有意であれば追記
  if (
    linkText &&
    linkText !== "会議録" &&
    linkText !== "PDF" &&
    linkText.length > 0
  ) {
    // 区分情報（1日目、2日目など）を含む場合
    if (
      linkText.includes("日目") ||
      linkText.includes("会議録") ||
      linkText.includes("議案") ||
      linkText.includes("審議")
    ) {
      return `${baseName} ${linkText}`.trim();
    }
  }

  return baseName;
}

/**
 * 指定年の会議録一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<ShiriuchiMeeting[]> {
  // Step 1: トップページから年度リンクを収集
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  const yearEntries = parseTopPage(topHtml);
  const targetEntry = yearEntries.find((e) => e.year === year);
  if (!targetEntry) return [];

  // Step 2: 年度ページから PDF リンクを収集
  const yearHtml = await fetchPage(targetEntry.url);
  if (!yearHtml) return [];

  await delay(INTER_REQUEST_DELAY_MS);

  const items = parseYearPage(yearHtml);

  return items.map((item) => ({
    pdfUrl: item.pdfUrl,
    title: item.title,
    heldOn: item.heldOn,
    meetingType: detectMeetingType(item.title),
    year,
  }));
}
