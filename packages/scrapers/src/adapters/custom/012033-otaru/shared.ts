/**
 * 小樽市議会 会議録 — 共通ユーティリティ
 *
 * API: http://local-politics.jp/otaru/api/
 * 地方議会会議録コーパスプロジェクトが提供する Elasticsearch ベースの REST API。
 * 匿名ログインで JWT を取得し、search エンドポイントで発言データを取得する。
 */

const API_BASE = "http://local-politics.jp/otaru/api";

const FETCH_TIMEOUT_MS = 30_000;

/** 検索条件のデフォルト値 */
const DEFAULT_COND = {
  text: "",
  shichosonCds: [],
  prefIso3166Codes: [],
  areas: [],
  isPhraseMatch: true,
  useOr: false,
  regexInput: { isTextRegexpMode: false, highlightRegexp: "" },
  sortFieldOrder: "date_asc",
} as const;

/** API レスポンスの1件分 */
export interface HatsugenRecord {
  id: string;
  speaker: string;
  title: string;
  ym: string;
  nendo: number;
  text: string;
  text_length: number;
}

/** search API のレスポンス */
interface SearchResponse {
  success: boolean;
  data: {
    _scroll_id: string;
    hits: {
      total: number;
      hits: Array<{
        _id: string;
        _source: HatsugenRecord;
      }>;
    };
  };
}

/** 匿名ログインで JWT を取得する */
export async function authenticate(): Promise<string> {
  const res = await fetch(`${API_BASE}/alogin`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const token = res.headers.get("set-authorization");
  if (!token) throw new Error("Failed to authenticate: no token in response");
  return token;
}

/** API に POST リクエストを送る */
async function apiPost(
  path: string,
  body: Record<string, unknown>,
  token: string,
): Promise<SearchResponse> {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  return (await res.json()) as SearchResponse;
}

/**
 * 指定 nendo の全発言レコードを取得する。
 * スクロールページネーションで全件を巡回する。
 */
export async function fetchAllRecords(
  nendo: number,
  token: string,
): Promise<HatsugenRecord[]> {
  const records: HatsugenRecord[] = [];

  const initial = await apiPost(
    `search/simple/cond/nendo_doc_values/nendo_doc_values/${nendo}/${nendo}`,
    { cond: { ...DEFAULT_COND } },
    token,
  );

  let hits = initial.data.hits.hits;
  let scrollId = initial.data._scroll_id;

  while (hits.length > 0) {
    for (const hit of hits) {
      records.push(hit._source);
    }

    const next = await apiPost(
      "search/scroll",
      { scrollId, cond: { ...DEFAULT_COND } },
      token,
    );
    hits = next.data.hits.hits;
    scrollId = next.data._scroll_id;
  }

  return records;
}

/** ym (YYMM) からカレンダー年を取得する */
export function ymToCalendarYear(ym: string): number {
  return 2000 + parseInt(ym.slice(0, 2), 10);
}

/** ym (YYMM) を YYYY-MM-01 形式に変換する */
export function ymToDate(ym: string): string {
  const year = 2000 + parseInt(ym.slice(0, 2), 10);
  const month = ym.slice(2, 4);
  return `${year}-${month}-01`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
