/**
 * kensakusystem.jp スクレイパー — list フェーズ
 *
 * URL パターンに応じて議事録スケジュール一覧を取得する。
 */

import { fetchWithEncoding, extractDate, stripHtmlTags } from "../_shared";

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

/**
 * sapphire.html から議事録一覧を取得
 */
export async function fetchFromSapphire(
  baseUrl: string
): Promise<KensakusystemSchedule[] | null> {
  const html = await fetchWithEncoding(baseUrl);
  if (!html) return null;

  const schedules: KensakusystemSchedule[] = [];

  const frameMatch = html.match(/src=["']([^"']*)/gi);
  if (!frameMatch) return null;

  for (const frame of frameMatch) {
    const frameUrl = frame.replace(/^src=["']/, "").replace(/["']$/, "");
    if (!frameUrl || frameUrl.startsWith("http")) continue;

    const absoluteUrl = new URL(frameUrl, baseUrl).toString();
    const contentHtml = await fetchWithEncoding(absoluteUrl);
    if (!contentHtml) continue;

    const linkMatches = contentHtml.matchAll(
      /href=["']([^"']*See\.exe[^"']*)["']\s*[^>]*>([^<]+)</gi
    );

    for (const match of linkMatches) {
      const href = match[1];
      const rawTitle = match[2];
      if (!href || !rawTitle) continue;
      const title = stripHtmlTags(rawTitle).trim();

      if (href && title) {
        const heldOn = extractDate(title);
        if (heldOn) {
          schedules.push({
            title,
            heldOn,
            url: new URL(href, baseUrl).toString(),
          });
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

  const schedules: KensakusystemSchedule[] = [];

  const linkMatches = html.matchAll(
    /href=["']([^"']*See\.exe[^"']*)["']\s*[^>]*>([^<]+)</gi
  );

  for (const match of linkMatches) {
    const href = match[1];
    const rawTitle = match[2];
    if (!href || !rawTitle) continue;
    const title = stripHtmlTags(rawTitle).trim();

    if (title) {
      const heldOn = extractDate(title);
      if (heldOn) {
        schedules.push({
          title,
          heldOn,
          url: new URL(href, baseUrl).toString(),
        });
      }
    }
  }

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

  const schedules: KensakusystemSchedule[] = [];

  const linkMatches = html.matchAll(
    /href=["']([^"']*(?:cgi-bin3\/)?See\.exe[^"']*)["']\s*[^>]*>([^<]+)</gi
  );

  for (const match of linkMatches) {
    const href = match[1];
    const rawTitle = match[2];
    if (!href || !rawTitle) continue;
    const title = stripHtmlTags(rawTitle).trim();

    if (title) {
      const heldOn = extractDate(title);
      if (heldOn) {
        schedules.push({
          title,
          heldOn,
          url: new URL(href, baseUrl).toString(),
        });
      }
    }
  }

  return schedules.length > 0 ? schedules : null;
}
