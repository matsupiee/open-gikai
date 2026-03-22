/**
 * 東村山市 — 共通ユーティリティ
 */

export const BASE_ORIGIN = "https://www.city.higashimurayama.tokyo.jp";
export const KENSAKU_PATH = "/gikai/gikaijoho/kensaku";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function detectMeetingType(
  category: "honkaigi" | "iinkai",
  section: string
): string {
  if (category === "iinkai") return "committee";
  if (section.includes("臨時")) return "extraordinary";
  return "plenary";
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/**
 * 西暦年から和暦 URL パス部分を生成する。
 * e.g., 2024 → "r6", 2019 → "h31"
 */
export function toEraPrefix(year: number): string | null {
  if (year >= 2020) return `r${year - 2018}`;
  if (year === 2019) return "h31";
  if (year >= 1989) return `h${year - 1988}`;
  if (year === 1988) return "s63";
  return null;
}

export function buildListUrl(
  eraPrefix: string,
  category: "honkaigi" | "iinkai"
): string {
  return `${BASE_ORIGIN}${KENSAKU_PATH}/${eraPrefix}_${category}/index.html`;
}

/**
 * PDF リンクの URL パスから externalId 用のキーを抽出する。
 * e.g., "/kensaku/r6_honkaigi/files/1224.pdf" → "r6_honkaigi_1224"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(
    /\/kensaku\/([^/]+)\/(?:files\/)?([^/]+)\.pdf$/i
  );
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
