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
  date: string | null;
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
    // baseUrl に index.php が含まれているかで URL スタイルの初期判定
    let pathPrefix = baseUrl.includes("/index.php/") ? "/index.php/" : "/";
    const topUrl = `${origin}${pathPrefix}`;

    // Step 1: トップページ取得 → CSRFトークン・Cookie・検索エンドポイントID
    const initRes = await fetch(topUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!initRes.ok) return null;

    const initHtml = await initRes.text();
    // CSRFトークンがないサイトもあるため、見つからなくても続行する
    const csrfToken = extractCsrfToken(initHtml) ?? "";

    // レスポンスの form action に /index.php/ が含まれていれば pathPrefix を修正する。
    // baseUrl に /index.php/ がなくても、サイトが実際に /index.php/ を使う場合がある
    // （例: トップが /index.php/ へリダイレクトされる新バージョンの dbsearch）。
    if (pathPrefix === "/" && detectIndexPhpFromHtml(initHtml)) {
      pathPrefix = "/index.php/";
    }

    const cookie = buildCookieHeader(initRes.headers);
    // トップページの form action → baseUrl → ページ内リンクの順にIDを探す
    const searchEndpointId =
      extractFormActionId(initHtml) ??
      extractEndpointIdFromUrl(baseUrl) ??
      extractEndpointIdFromLinks(initHtml);
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
  } catch (err) {
    console.warn(`[dbsearch] fetchMeetingList failed for ${baseUrl} (year=${year}):`, err instanceof Error ? err.message : err);
    return null;
  }
}

// --- 内部ユーティリティ ---

function toHttpsOrigin(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = "https:";
  return url.origin;
}

/** @internal テスト用にexport */
export function extractCsrfToken(html: string): string | null {
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
/** @internal テスト用にexport */
export function extractFormActionId(html: string): string | null {
  const m = html.match(/action="[^"]+\/(\d+)(?:\?[^"]*)?"/);
  return m?.[1] ?? null;
}

/**
 * URL のパスからエンドポイントIDを抽出する。
 * baseUrl にエンドポイントIDが含まれている場合のフォールバック用。
 * 旧形式: /index.php/12345
 * 新形式: /100000?Template=search-phrase
 */
/** @internal テスト用にexport */
export function extractEndpointIdFromUrl(url: string): string | null {
  const m =
    url.match(/\/index\.php\/(\d+)/) ?? url.match(/\/(\d+)(?:\?|$)/);
  return m?.[1] ?? null;
}

/**
 * ページ内の <a href> リンクからエンドポイントIDを抽出する。
 * フォーム action や baseUrl からIDが取れない場合のフォールバック。
 */
function extractEndpointIdFromLinks(html: string): string | null {
  const m = html.match(/href="[^"]*\/index\.php\/(\d+)/) ?? html.match(/href="[^"]*\/(\d{5,})(?:\?|")/);
  return m?.[1] ?? null;
}

/**
 * HTML の form action やリンクに /index.php/ が含まれているか検出する。
 * baseUrl に /index.php/ がなくてもサイトが実際に使っている場合を検出するため。
 */
/** @internal テスト用にexport */
export function detectIndexPhpFromHtml(html: string): boolean {
  return /action="[^"]*\/index\.php\/\d+/.test(html) ||
    /href="[^"]*\/index\.php\/\d+/.test(html);
}

/**
 * 結果ページの HTML から議事録レコードを抽出する。
 * 旧形式: href="...?Template=view&Id={docId}..."
 * 新形式: href="...?Template=document&Id={docId}..."
 */
/** @internal テスト用にexport */
export function parseListHtml(
  html: string,
  origin: string
): DbsearchMeetingRecord[] {
  const records: DbsearchMeetingRecord[] = [];
  const seen = new Set<string>();

  // 旧形式: &Id=123 / 新形式: &DocumentID=123
  // Template の値: view, document（旧）, doc-one-frame, doc-all-frame（新）
  const anchorPattern =
    /<a\s[^>]*href="([^"]+Template=(?:view|document|doc-one-frame|doc-all-frame)[^"]*(?:&amp;|&)(?:Document)?[Ii][Dd]=(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/gi;

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

    // アンカー直後の日付 span を探す (複数のクラス名・形式に対応)
    const afterAnchor = html.slice(match.index + match[0].length, match.index + match[0].length + 300);
    const date = extractListDate(afterAnchor);

    // 相対URLの場合はoriginを補完する
    const url = rawUrl.startsWith("http") ? rawUrl : `${origin}${rawUrl}`;
    records.push({ id: docId, url, title, date });
  }

  return records;
}

/**
 * リストのアンカー直後のHTMLから日付を抽出する。
 * 対応形式:
 *   - <span class="result-title__date">2025-12-24</span>
 *   - <span class="result-document-date">2025-12-19</span>
 *   - <span class="result-title__date">開催日：2025-12-11</span>
 *   - <span class="date">2025年12月19日</span>
 *   - <div class="date">開催日：2025年12月19日</div>
 */
/** @internal テスト用にexport */
export function extractListDate(html: string): string | null {
  // ISO 形式 (YYYY-MM-DD)
  // ネストされた span/div でも検出できるよう、タグ構造に依存しない汎用パターンを使う
  const iso = html.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso?.[1]) return iso[1];

  // 日本語形式 (YYYY年MM月DD日) — 「開催日：」等のプレフィックスを許容
  const ja = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (ja?.[1] && ja[2] && ja[3]) {
    return `${ja[1]}-${ja[2].padStart(2, "0")}-${ja[3].padStart(2, "0")}`;
  }

  return null;
}

/**
 * 結果ページに「次のページ」ボタンが存在するか確認する。
 */
/** @internal テスト用にexport */
export function hasNextPage(html: string): boolean {
  // aria-label="次のページ" かつ aria-disabled="false" のボタンがあれば次ページあり
  return /aria-label="次のページ"[^>]*aria-disabled="false"|aria-disabled="false"[^>]*aria-label="次のページ"/.test(
    html
  );
}
