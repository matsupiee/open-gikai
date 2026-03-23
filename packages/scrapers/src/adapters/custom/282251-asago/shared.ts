/**
 * 朝来市議会 会議録検索システム — 共通ユーティリティ
 *
 * サイト: https://www.voicetechno.net/MinutesSystem/Asago/
 * VoiceTechno 社製 ASP.NET + DevExpress システム。
 * 各ドロップダウンを順次 postback して会議録を取得する。
 */

export const BASE_URL =
  "https://www.voicetechno.net/MinutesSystem/Asago/Default.aspx";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議種別: ドロップダウンの選択肢 */
export const MEETING_KINDS = ["本会議", "委員会"] as const;

/**
 * ASP.NET hidden fields を HTML から抽出する。
 */
export function extractAspNetFields(html: string): {
  viewstate: string;
  viewstateGen: string;
  eventValidation: string;
} {
  return {
    viewstate:
      html.match(
        /name="__VIEWSTATE"\s+id="[^"]*"\s+value="([^"]*)"/,
      )?.[1] ?? "",
    viewstateGen:
      html.match(
        /name="__VIEWSTATEGENERATOR"\s+id="[^"]*"\s+value="([^"]*)"/,
      )?.[1] ?? "",
    eventValidation:
      html.match(
        /name="__EVENTVALIDATION"\s+id="[^"]*"\s+value="([^"]*)"/,
      )?.[1] ?? "",
  };
}

/**
 * 数値年からドロップダウンの年度ラベルを生成する。
 * 例: 2024 → "2024(令和６年)"
 */
export function buildYearLabel(year: number): string {
  if (year === 2019) return "2019(平成31年、令和元年)";
  if (year >= 2020) {
    const reiwa = year - 2018;
    return `${year}(令和${toFullWidth(String(reiwa))}年)`;
  }
  const heisei = year - 1988;
  return `${year}(平成${heisei}年)`;
}

function toFullWidth(s: string): string {
  return s.replace(/[0-9]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) + 0xfee0),
  );
}

/**
 * 会議名から開催日 (YYYY-MM-DD) を抽出する。
 * 例: "令和６年 第17回（定例）朝来市議会会議録（第１日：令和６年２月29日）" → "2024-02-29"
 */
export function extractHeldOn(name: string): string | null {
  const dates = [
    ...name.matchAll(
      /(?:令和|平成)([０-９\d]+)年([０-９\d]+)月([０-９\d]+)日/g,
    ),
  ];
  if (dates.length === 0) return null;

  // 最後の日付を使う（会議名の中で実際の開催日は最後に記載される）
  const last = dates[dates.length - 1]!;
  const toHalf = (s: string) =>
    s.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
  const eraYear = parseInt(toHalf(last[1]!));
  const month = parseInt(toHalf(last[2]!));
  const day = parseInt(toHalf(last[3]!));

  // 直前のテキストから元号を判定
  const textBeforeMatch = name.substring(0, last.index!);
  const lastReiwa = textBeforeMatch.lastIndexOf("令和");
  const lastHeisei = textBeforeMatch.lastIndexOf("平成");
  const isReiwa =
    lastReiwa >= lastHeisei || (lastReiwa === -1 && name.includes("令和"));
  const calendarYear = isReiwa ? 2018 + eraYear : 1988 + eraYear;

  return `${calendarYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * ASP.NET postback リクエストを送信する。
 * セッション cookie を維持するため cookie ヘッダーを受け取る。
 */
export async function postBack(
  sessionCookie: string,
  fields: ReturnType<typeof extractAspNetFields>,
  eventTarget: string,
  formValues: Record<string, string>,
): Promise<string> {
  const body = new URLSearchParams({
    __EVENTTARGET: eventTarget,
    __EVENTARGUMENT: "",
    __VIEWSTATE: fields.viewstate,
    __VIEWSTATEGENERATOR: fields.viewstateGen,
    __EVENTVALIDATION: fields.eventValidation,
    ...formValues,
  });

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`postBack failed: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

/**
 * 初期ページを取得し、セッション cookie と hidden fields を返す。
 */
export async function fetchInitialPage(): Promise<{
  html: string;
  sessionCookie: string;
}> {
  const res = await fetch(BASE_URL, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`fetchInitialPage failed: ${res.status}`);
  }

  const html = await res.text();
  const cookies =
    (res.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie?.() ?? [];
  const sessionCookie = cookies
    .map((c: string) => c.split(";")[0])
    .join("; ");

  return { html, sessionCookie };
}

/**
 * コンボボックスの itemsValue を HTML から抽出する。
 */
export function extractComboItems(
  html: string,
  comboId: string,
): string[] {
  const regex = new RegExp(
    comboId.replace(/\$/g, "\\$") + "[\\s\\S]*?'itemsValue':\\[([^\\]]+)\\]",
  );
  const match = html.match(regex);
  if (!match?.[1]) return [];

  // Parse the comma-separated quoted strings
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]!);
}
