export const BASE_ORIGIN = "https://www.town.chikuzen.fukuoka.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function parseWarekiYear(text: string): number | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(令和|平成|昭和)\s*(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);

  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  if (era === "昭和") return 1925 + eraYear;
  return null;
}

export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) {
    return "extraordinary";
  }
  return "plenary";
}

export function toAbsoluteUrl(url: string, baseUrl = BASE_ORIGIN): string {
  return new URL(url, baseUrl).href;
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
