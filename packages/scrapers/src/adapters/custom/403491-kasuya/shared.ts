export const BASE_ORIGIN = "https://www.town.kasuya.fukuoka.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員")) return "committee";
  return "plenary";
}

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  if (Number.isNaN(eraYear)) return null;

  if (match[1] === "令和") return eraYear + 2018;
  if (match[1] === "平成") return eraYear + 1988;
  return null;
}

export function parseWarekiDate(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(
    /(令和|平成)\s*(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
  );
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if ([eraYear, month, day].some((value) => Number.isNaN(value))) return null;

  const westernYear = match[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchPage failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(
      `fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchBinary failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(
      `fetchBinary error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
