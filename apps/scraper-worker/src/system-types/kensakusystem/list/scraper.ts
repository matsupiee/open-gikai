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
  stripHtmlTags,
} from "../_shared";

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

/**
 * sapphire.html から議事録一覧を取得。
 *
 * 処理フロー:
 * 1. sapphire.html から See.exe ツリーページへのリンクを取得
 * 2. ツリーページから年タブの treedepth 値（Shift-JIS raw bytes）を抽出
 * 3. 各年の treedepth で POST → 委員会一覧を取得
 * 4. 各委員会の treedepth で POST → 個別議事録リンク (ResultFrame.exe) を取得
 * 5. ResultFrame.exe リンクをスケジュールとして返す
 *
 * POST body の treedepth は Shift-JIS のまま percent-encode する。
 * URLSearchParams は UTF-8 エンコードするため使用不可。
 */
export async function fetchFromSapphire(
  baseUrl: string
): Promise<KensakusystemSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  // sapphire.html に直接 See.exe 議事録リンクがあれば使う
  const directLinks = extractSeeLinks(html, baseUrl);
  if (directLinks.length > 0) return directLinks;

  // sapphire.html から See.exe ツリーページへのリンクを探す
  const seeExeMatch = html.match(/href=["']([^"']*See\.exe[^"']*)[\"']/i);
  if (!seeExeMatch?.[1]) return null;

  const seeExeUrl = new URL(seeExeMatch[1], baseUrl).toString();

  // ツリーページを raw bytes と decoded HTML の両方で取得
  const treeRawBytes = await fetchRawBytes(seeExeUrl);
  if (!treeRawBytes) return null;
  const treeHtml = decodeShiftJis(treeRawBytes);

  // ツリーページに直接 See.exe 議事録リンクがあれば使う
  const treeDirectLinks = extractSeeLinks(treeHtml, seeExeUrl);
  if (treeDirectLinks.length > 0) return treeDirectLinks;

  // viewtree フォームの action を取得
  const formActionMatch = treeHtml.match(
    /name=["']viewtree["'][^>]*action=["']([^"']+)["']|action=["']([^"']+)["'][^>]*name=["']viewtree["']/i
  );
  const formAction = formActionMatch?.[1] ?? formActionMatch?.[2];
  if (!formAction) return null;

  const absoluteFormAction = new URL(formAction, seeExeUrl).toString();
  const hiddenInputs = extractHiddenInputs(treeHtml);
  const baseParams = buildBaseParams(hiddenInputs);

  // ツリーページから年レベルの treedepth raw bytes を抽出
  const yearTreedepths = extractTreedepthRawBytes(treeRawBytes);
  if (yearTreedepths.length === 0) return null;

  const schedules: KensakusystemSchedule[] = [];
  const seenUrls = new Set<string>();

  for (const yearBytes of yearTreedepths) {
    const yearBody = `${baseParams}&treedepth=${percentEncodeBytes(yearBytes)}`;
    const yearRawBytes = await fetchRawBytesPost(absoluteFormAction, yearBody);
    if (!yearRawBytes) continue;
    const yearHtml = decodeShiftJis(yearRawBytes);

    // 年レベルのレスポンスに ResultFrame.exe リンクがあれば収集（本会議など）
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

    // 委員会レベルの treedepth を抽出（年レベルのものを除外）
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
    }
  }

  return schedules.length > 0 ? schedules : null;
}

/**
 * CGI (Search2.exe) インターフェースから議事録一覧を取得
 */
export async function fetchFromCgi(
  baseUrl: string
): Promise<KensakusystemSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;
  const schedules = extractSeeLinks(html, baseUrl);
  return schedules.length > 0 ? schedules : null;
}

/**
 * index.html ページから議事録一覧を取得
 */
export async function fetchFromIndexHtml(
  baseUrl: string
): Promise<KensakusystemSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;
  const schedules = extractSeeLinks(html, baseUrl);
  return schedules.length > 0 ? schedules : null;
}
