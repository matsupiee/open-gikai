/**
 * dbsr.jp スクレイパー — list フェーズ
 *
 * baseUrl から議事録 ID 一覧を取得する。
 */

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

export interface DbsearchMeetingRecord {
  id: string;
  url: string;
  title: string;
}

/**
 * 議事録一覧ページを取得して、議事録 ID と URL のリストを抽出する。
 * 失敗時は null を返す。
 */
export async function fetchMeetingList(
  baseUrl: string
): Promise<DbsearchMeetingRecord[] | null> {
  try {
    const url = normalizeBaseUrl(baseUrl);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const records: DbsearchMeetingRecord[] = [];
    const linkPattern = /index\.php\/(\d+)\?[^"']*(?:["\']|$)/gi;
    let match;
    const seenIds = new Set<string>();

    while ((match = linkPattern.exec(html)) !== null) {
      const id = match[1];
      if (id && !seenIds.has(id)) {
        seenIds.add(id);
        const detailUrl = buildDetailUrl(url, id);
        records.push({
          id,
          url: detailUrl,
          title: `議事録 ${id}`,
        });
      }
    }

    return records.length > 0 ? records : null;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) {
    url.pathname += "/";
  }
  return url.toString().replace(/\/$/, "");
}

function buildDetailUrl(baseUrl: string, id: string): string {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/index\.php\/?.*$/, "");
  return `${url.origin}${basePath}/index.php/${id}?Template=search-detail`;
}
