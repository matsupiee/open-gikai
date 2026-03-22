/**
 * kensakusystem.jp スクレイパー — list フェーズ
 *
 * URL パターンに応じて議事録スケジュール一覧を取得する。
 */

import {
  fetchWithEncoding,
  fetchRawBytes,
  fetchRawBytesPost,
  decodeShiftJis,
  percentEncodeBytes,
  extractTreedepthRawBytes,
  extractDate,
  normalizeFullWidth,
  stripHtmlTags,
} from "./shared";

export interface KensakusystemSchedule {
  title: string;
  heldOn: string; // YYYY-MM-DD
  url: string;
}

/** baseUrl から slug（自治体識別子）を抽出する */
export function extractSlugFromUrl(baseUrl: string): string | null {
  const match = baseUrl.match(/kensakusystem\.jp\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isSapphireType(baseUrl: string): boolean {
  return baseUrl.includes("sapphire.html");
}

export function isCgiType(baseUrl: string): boolean {
  return baseUrl.includes("Search2.exe");
}

export function isIndexHtmlType(baseUrl: string): boolean {
  return baseUrl.includes("index.html");
}

const ERA_BASE: Record<string, number> = {
  R: 2018, // 令和
  H: 1988, // 平成
  S: 1925, // 昭和
};

/**
 * ファイル名から日付を解析する
 * 例: R080106B02 → 令和8年1月6日 → 2026-01-06
 */
export function parseDateFromFilename(fileName: string): string | null {
  const m = fileName.match(/^([RHS])(\d{2})(\d{2})(\d{2})/i);
  if (!m) return null;
  const eraKey = m[1]!.toUpperCase();
  const base = ERA_BASE[eraKey];
  if (base === undefined) return null;
  const year = base + Number(m[2]);
  const monthRaw = m[3]!.padStart(2, "0");
  const dayRaw = m[4]!.padStart(2, "0");
  // "00" の場合（ファイル名が日付ではなく通し番号の場合）は月初・1月にフォールバック
  const month = monthRaw === "00" ? "01" : monthRaw;
  const day = dayRaw === "00" ? "01" : dayRaw;
  return `${year}-${month}-${day}`;
}

/** HTML 中の See.exe リンクを抽出してスケジュール一覧を返す */
function extractSeeLinks(
  html: string,
  baseUrl: string
): KensakusystemSchedule[] {
  const schedules: KensakusystemSchedule[] = [];
  const linkMatches = html.matchAll(
    /href=["']([^"']*See\.exe[^"']*)[\"']\s*[^>]*>([^<]+)</gi
  );
  for (const match of linkMatches) {
    const href = match[1];
    const rawTitle = match[2];
    if (!href || !rawTitle) continue;
    const title = stripHtmlTags(rawTitle).trim();
    if (!title) continue;
    const heldOn = extractDate(title);
    if (heldOn) {
      schedules.push({
        title,
        heldOn,
        url: new URL(href, baseUrl).toString(),
      });
    }
  }
  return schedules;
}

/**
 * ResultFrame.exe リンクを抽出してスケジュール一覧を返す。
 * 日付はファイル名から解析する（リンクテキストは年が欠落しているため）。
 */
function extractResultFrameLinks(
  html: string,
  baseUrl: string,
  committeeName?: string
): KensakusystemSchedule[] {
  const schedules: KensakusystemSchedule[] = [];
  for (const match of html.matchAll(
    /href=["']([^"']*ResultFrame\.exe[^"']*)["']/gi
  )) {
    const rawHref = match[1];
    if (!rawHref) continue;
    // &amp; を & にデコード
    const href = rawHref.replace(/&amp;/gi, "&");
    const fileNameMatch = href.match(/[?&]fileName=([^&]+)/i);
    if (!fileNameMatch?.[1]) continue;
    const fileName = fileNameMatch[1];
    const heldOn = parseDateFromFilename(fileName);
    if (!heldOn) continue;
    const url = new URL(href, baseUrl).toString();
    const title = committeeName ? `${committeeName.trim()} ${heldOn}` : heldOn;
    schedules.push({ title, heldOn, url });
  }
  return schedules;
}

/** フォームの hidden inputs を HTML から抽出する */
function extractHiddenInputs(html: string): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const m of html.matchAll(
    /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi
  )) {
    if (m[1]) inputs[m[1]] = m[2] ?? "";
  }
  for (const m of html.matchAll(
    /<input[^>]*type=["']hidden["'][^>]*value=["']([^"']*)["'][^>]*name=["']([^"']+)["']/gi
  )) {
    if (m[2] && !(m[2] in inputs)) inputs[m[2]] = m[1] ?? "";
  }
  return inputs;
}

/**
 * 2つの Uint8Array が等しいか比較する
 */
function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * hidden inputs から POST body の base 部分を構築する（treedepth を除く）。
 * Code などの ASCII フィールドは encodeURIComponent でエンコードする。
 */
function buildBaseParams(hiddenInputs: Record<string, string>): string {
  return Object.entries(hiddenInputs)
    .filter(([k]) => k !== "treedepth")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** treedepth ラベル（例: "令和7年" "平成30年"）から西暦年を抽出する */
function extractYearFromLabel(label: string): number | null {
  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };
  for (const [era, base] of Object.entries(wareki)) {
    const m = label.match(new RegExp(`${era}\\s*(\\d+)\\s*年`));
    if (m?.[1]) return base + Number(m[1]);
  }
  const western = label.match(/(\d{4})\s*年/);
  if (western?.[1]) return Number(western[1]);
  return null;
}

/**
 * ツリーページから treedepth ナビゲーションで議事録スケジュールを収集する。
 *
 * 年タブ → 委員会タブ → ResultFrame.exe リンクの順に探索する。
 */
async function navigateTreedepths(
  treeRawBytes: Uint8Array,
  treeHtml: string,
  treePageUrl: string,
  targetYear?: number
): Promise<KensakusystemSchedule[]> {
  const formActionMatch = treeHtml.match(
    /name=["']viewtree["'][^>]*action=["']([^"']+)["']|action=["']([^"']+)["'][^>]*name=["']viewtree["']/i
  );
  const formAction = formActionMatch?.[1] ?? formActionMatch?.[2];
  if (!formAction) return [];

  const absoluteFormAction = new URL(formAction, treePageUrl).toString();
  const hiddenInputs = extractHiddenInputs(treeHtml);
  const baseParams = buildBaseParams(hiddenInputs);

  const yearTreedepths = extractTreedepthRawBytes(treeRawBytes);
  if (yearTreedepths.length === 0) return [];

  const schedules: KensakusystemSchedule[] = [];
  const seenUrls = new Set<string>();

  for (const yearBytes of yearTreedepths) {
    if (targetYear) {
      const yearLabel = normalizeFullWidth(decodeShiftJis(yearBytes));
      const labelYear = extractYearFromLabel(yearLabel);
      // タブグループは複数年をカバーし、ラベルは最新年で表示される
      // （例: "令和 8年" タブが令和7-8年をカバー）ため、targetYear + 1 も許可する
      if (
        labelYear &&
        labelYear !== targetYear &&
        labelYear !== targetYear - 1 &&
        labelYear !== targetYear + 1
      ) {
        continue;
      }
    }

    const yearBody = `${baseParams}&treedepth=${percentEncodeBytes(yearBytes)}`;
    const yearRawBytes = await fetchRawBytesPost(absoluteFormAction, yearBody);
    if (!yearRawBytes) continue;
    const yearHtml = decodeShiftJis(yearRawBytes);

    const directResultLinks = extractResultFrameLinks(
      yearHtml,
      absoluteFormAction
    );
    for (const link of directResultLinks) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        schedules.push(link);
      }
    }

    const allTreedepths = extractTreedepthRawBytes(yearRawBytes);
    const committeeTreedepths = allTreedepths.filter(
      (td) => !yearTreedepths.some((y) => bytesEqual(y, td))
    );

    for (const committeeBytes of committeeTreedepths) {
      const committeeName = decodeShiftJis(committeeBytes);
      const committeeBody = `${baseParams}&treedepth=${percentEncodeBytes(
        committeeBytes
      )}`;
      const meetingRawBytes = await fetchRawBytesPost(
        absoluteFormAction,
        committeeBody
      );
      if (!meetingRawBytes) continue;
      const meetingHtml = decodeShiftJis(meetingRawBytes);

      const resultFrameLinks = extractResultFrameLinks(
        meetingHtml,
        absoluteFormAction,
        committeeName
      );
      for (const link of resultFrameLinks) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          schedules.push(link);
        }
      }

      // 3レベル構造対応: ResultFrame リンクがなく新たな treedepth がある場合、
      // もう1段深く探索する（豊田市・西脇市など年グループ→個別年→セッションの構造）
      if (resultFrameLinks.length === 0) {
        const subTreedepths = extractTreedepthRawBytes(meetingRawBytes);
        const newSubTreedepths = subTreedepths.filter(
          (td) =>
            !yearTreedepths.some((y) => bytesEqual(y, td)) &&
            !committeeTreedepths.some((c) => bytesEqual(c, td))
        );
        for (const subBytes of newSubTreedepths) {
          const subName = decodeShiftJis(subBytes);
          const subBody = `${baseParams}&treedepth=${percentEncodeBytes(subBytes)}`;
          const subRawBytes = await fetchRawBytesPost(absoluteFormAction, subBody);
          if (!subRawBytes) continue;
          const subHtml = decodeShiftJis(subRawBytes);
          const subLinks = extractResultFrameLinks(subHtml, absoluteFormAction, subName);
          for (const link of subLinks) {
            if (!seenUrls.has(link.url)) {
              seenUrls.add(link.url);
              schedules.push(link);
            }
          }
        }
      }
    }
  }

  return schedules;
}

/**
 * ページからスケジュール一覧を取得する汎用関数。
 *
 * 処理フロー:
 * 1. ページを取得し、直接の See.exe / ResultFrame.exe リンクを探す
 * 2. ページ自体がツリーページ（viewtree フォームあり）なら treedepth ナビゲーション
 * 3. ページ内の See.exe リンクを辿ってツリーページに到達し、treedepth ナビゲーション
 *
 * POST body の treedepth は Shift-JIS のまま percent-encode する。
 * URLSearchParams は UTF-8 エンコードするため使用不可。
 */
export async function fetchFromSapphire(
  baseUrl: string,
  targetYear?: number
): Promise<KensakusystemSchedule[] | null> {
  // raw bytes で取得（treedepth 抽出に必要）し、同時に HTML にデコード
  const rawBytes = await fetchRawBytes(baseUrl);

  if (rawBytes) {
    const html = decodeShiftJis(rawBytes);

    // 直接 See.exe 議事録リンクがあれば使う
    const directLinks = extractSeeLinks(html, baseUrl);
    if (directLinks.length > 0) return directLinks;

    // 直接 ResultFrame.exe リンクがあれば使う（See.exe ツリーページが直接渡された場合）
    const directResultLinks = extractResultFrameLinks(html, baseUrl);
    if (directResultLinks.length > 0) return directResultLinks;

    // 現在のページがツリーページ（viewtree フォームあり）の場合、直接 treedepth ナビゲーション
    const currentTreedepths = extractTreedepthRawBytes(rawBytes);
    if (currentTreedepths.length > 0) {
      const treeSchedules = await navigateTreedepths(
        rawBytes,
        html,
        baseUrl,
        targetYear
      );
      if (treeSchedules.length > 0) return treeSchedules;
    }

    // See.exe ツリーページへのリンクを探して辿る
    const result = await followSeeExeLink(html, baseUrl, targetYear);
    if (result && result.length > 0) return result;
  }

  // See.exe リンクが見つからない場合、トップページから最新の Code を取得して再試行
  // （Code 失効時や URL が 404 だった場合のフォールバック）
  const slug = extractSlugFromUrl(baseUrl);
  if (slug) {
    const topPages = [
      `https://www.kensakusystem.jp/${slug}/index.html`,
      `https://www.kensakusystem.jp/${slug}/sapphire.html`,
    ];
    for (const topUrl of topPages) {
      // 元の URL と同じページは二重取得を避ける
      if (normalizeUrl(topUrl) === normalizeUrl(baseUrl)) continue;

      const topRawBytes = await fetchRawBytes(topUrl);
      if (!topRawBytes) continue;
      const topHtml = decodeShiftJis(topRawBytes);

      const topResult = await followSeeExeLink(topHtml, topUrl, targetYear);
      if (topResult && topResult.length > 0) return topResult;
    }
  }

  return null;
}

/** URL を正規化して比較可能にする（http/https とパスの違いを吸収） */
function normalizeUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** HTML 中の See.exe リンクを辿ってツリーページに到達し、スケジュールを取得する */
async function followSeeExeLink(
  html: string,
  pageUrl: string,
  targetYear?: number
): Promise<KensakusystemSchedule[] | null> {
  const seeExeMatch = html.match(/href=["']([^"']*See\.exe[^"']*)[\"']/i);
  if (!seeExeMatch?.[1]) return null;

  const seeExeUrl = new URL(seeExeMatch[1], pageUrl).toString();

  const treeRawBytes = await fetchRawBytes(seeExeUrl);
  if (!treeRawBytes) return null;
  const treeHtml = decodeShiftJis(treeRawBytes);

  // ツリーページに直接 See.exe 議事録リンクがあれば使う
  const treeDirectLinks = extractSeeLinks(treeHtml, seeExeUrl);
  if (treeDirectLinks.length > 0) return treeDirectLinks;

  // ツリーページで treedepth ナビゲーション
  const treeSchedules = await navigateTreedepths(
    treeRawBytes,
    treeHtml,
    seeExeUrl,
    targetYear
  );
  return treeSchedules.length > 0 ? treeSchedules : null;
}

/**
 * CGI (Search2.exe) インターフェースから議事録一覧を取得。
 *
 * Search2.exe?sTarget=2 のような全文検索フォームページの場合、
 * 日付つき See.exe リンクが直接ないため、ページ内の See.exe メニューリンクを
 * 辿って sapphire フロー（treedepth ナビゲーション）にフォールバックする。
 */
export async function fetchFromCgi(
  baseUrl: string,
  targetYear?: number
): Promise<KensakusystemSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  const schedules = extractSeeLinks(html, baseUrl);
  if (schedules.length > 0) return schedules;

  // 日付つき See.exe リンクが見つからない場合（例: Search2.exe?sTarget=2 の検索フォームページ）:
  // ページ内に See.exe ツリービューへのメニューリンクがある可能性がある。
  // sapphire フロー（treedepth ナビゲーション）で再試行する。
  return fetchFromSapphire(baseUrl, targetYear);
}

/**
 * index.html ページから議事録一覧を取得。
 *
 * index.html にはナビゲーション用の See.exe リンク（例: "会議録の閲覧"）が
 * 含まれるが日付情報を持たない場合がある（弘前市・下妻市など）。
 * 日付つきリンクが見つからない場合は sapphire フローにフォールバックする。
 */
export async function fetchFromIndexHtml(
  baseUrl: string,
  targetYear?: number
): Promise<KensakusystemSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  const schedules = extractSeeLinks(html, baseUrl);
  if (schedules.length > 0) return schedules;

  // 日付つき See.exe リンクが見つからない場合:
  // sapphire フロー（treedepth ナビゲーション）で再試行する。
  return fetchFromSapphire(baseUrl, targetYear);
}
