/**
 * dbsr.jp スクレイパー — list フェーズ
 *
 * 1. トップページ GET → CSRFトークン + セッションCookie + 検索エンドポイントIDを取得
 * 2. 検索エンドポイントへ POST → 年フィルタで議事録一覧を取得
 * 3. ページネーションを処理してすべての議事録を収集
 *
 * URL スタイルの違い:
 *   旧形式 (dbsr.jp):    https://foo.dbsr.jp/index.php/{endpointId}
 *   新形式 (東京都など):  https://www.record.gikai.metro.tokyo.lg.jp/{endpointId}
 */

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

export interface DbsearchMeetingRecord {
  id: string;
  url: string;
  title: string;
}

/**
 * 指定年の議事録一覧を取得する。
 * 失敗時は null を返す。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<DbsearchMeetingRecord[] | null> {
  try {
    const origin = toHttpsOrigin(baseUrl);
    // baseUrl に index.php が含まれているかで URL スタイルを判定
    const pathPrefix = baseUrl.includes("/index.php/") ? "/index.php/" : "/";
    const topUrl = `${origin}${pathPrefix}`;

    // Step 1: トップページ取得 → CSRFトークン・Cookie・検索エンドポイントID
    const initRes = await fetch(topUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!initRes.ok) return null;

    const initHtml = await initRes.text();
    const csrfToken = extractCsrfToken(initHtml);
    if (!csrfToken) return null;

    const cookie = buildCookieHeader(initRes.headers);
    // トップページの form action からIDを取得できない場合は baseUrl 自体から抽出する
    const searchEndpointId =
      extractFormActionId(initHtml) ?? extractEndpointIdFromUrl(baseUrl);
    if (!searchEndpointId) return null;

    const searchUrl = `${origin}${pathPrefix}${searchEndpointId}`;

    // Step 2: 年フィルタ付きで POST → 1ページ目の結果とセッションIDを取得
    const firstRes = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
        Referer: topUrl,
      },
      body: new URLSearchParams({
        _token: csrfToken,
        Phrase: "",
        TermStartYear: String(year),
        TermEndYear: String(year),
        QueryType: "new",
        Template: "list",
        ListType: "text",
      }).toString(),
    });
    if (!firstRes.ok) return null;

    const firstHtml = await firstRes.text();
    const sessionEndpointId = extractFormActionId(firstHtml);

    const allRecords: DbsearchMeetingRecord[] = [];
    const firstPageRecords = parseListHtml(firstHtml, origin);
    allRecords.push(...firstPageRecords);

    // Step 3: ページネーション処理
    if (sessionEndpointId && hasNextPage(firstHtml)) {
      const sessionUrl = `${origin}${pathPrefix}${sessionEndpointId}`;
      let page = 2;

      while (true) {
        const res = await fetch(sessionUrl, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: cookie,
          },
          body: new URLSearchParams({
            _token: csrfToken,
            Template: "list",
            Page: String(page),
          }).toString(),
        });
        if (!res.ok) break;

        const html = await res.text();
        const records = parseListHtml(html, origin);
        if (records.length === 0) break;

        allRecords.push(...records);
        if (!hasNextPage(html)) break;
        page++;
      }
    }

    return allRecords.length > 0 ? allRecords : null;
  } catch {
    return null;
  }
}

// --- 内部ユーティリティ ---

function toHttpsOrigin(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = "https:";
  return url.origin;
}

function extractCsrfToken(html: string): string | null {
  const m = html.match(/name="csrf-token"\s+content="([^"]+)"/);
  return m?.[1] ?? null;
}

function buildCookieHeader(headers: Headers): string {
  // getSetCookie() は Cloudflare Workers / Node 18+ で利用可能
  const h = headers as unknown as { getSetCookie?: () => string[] };
  const cookies: string[] =
    typeof h.getSetCookie === "function"
      ? h.getSetCookie()
      : [headers.get("set-cookie") ?? ""];

  return cookies
    .map((c) => c.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");
}

/**
 * HTML から form action 内のエンドポイントIDを抽出する。
 * 旧形式: action="https://foo.dbsr.jp/index.php/12345"
 * 新形式: action="https://www.record.gikai.metro.tokyo.lg.jp/916983"
 */
function extractFormActionId(html: string): string | null {
  const m = html.match(/action="[^"]+\/(\d+)(?:\?[^"]*)?"/);
  return m?.[1] ?? null;
}

/**
 * URL のパスからエンドポイントIDを抽出する。
 * baseUrl にエンドポイントIDが含まれている場合のフォールバック用。
 * 旧形式: /index.php/12345
 * 新形式: /100000?Template=search-phrase
 */
function extractEndpointIdFromUrl(url: string): string | null {
  const m =
    url.match(/\/index\.php\/(\d+)/) ?? url.match(/\/(\d+)(?:\?|$)/);
  return m?.[1] ?? null;
}

/**
 * 結果ページの HTML から議事録レコードを抽出する。
 * 旧形式: href="...?Template=view&Id={docId}..."
 * 新形式: href="...?Template=document&Id={docId}..."
 */
function parseListHtml(
  html: string,
  origin: string
): DbsearchMeetingRecord[] {
  const records: DbsearchMeetingRecord[] = [];
  const seen = new Set<string>();

  const anchorPattern =
    /<a\s[^>]*href="([^"]+Template=(?:view|document)[^"]*(?:&amp;|&)Id=(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/gi;

  let match;
  while ((match = anchorPattern.exec(html)) !== null) {
    const rawUrl = (match[1] ?? "")
      .replace(/&amp;/g, "&")
      .replace(/#[^"]*$/, "")
      .trim();
    const docId = match[2];
    const title = (match[3] ?? "").replace(/\s+/g, " ").trim();

    if (!docId || seen.has(docId)) continue;
    seen.add(docId);

    // 相対URLの場合はoriginを補完する
    const url = rawUrl.startsWith("http") ? rawUrl : `${origin}${rawUrl}`;
    records.push({ id: docId, url, title });
  }

  return records;
}

/**
 * 結果ページに「次のページ」ボタンが存在するか確認する。
 */
function hasNextPage(html: string): boolean {
  // aria-label="次のページ" かつ aria-disabled="false" のボタンがあれば次ページあり
  return /aria-label="次のページ"[^>]*aria-disabled="false"|aria-disabled="false"[^>]*aria-label="次のページ"/.test(
    html
  );
}
