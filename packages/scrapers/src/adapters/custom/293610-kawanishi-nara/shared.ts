export const BASE_ORIGIN = "https://www.town.nara-kawanishi.lg.jp";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export type KawanishiMeetingType =
  | "plenary"
  | "extraordinary"
  | "committee";

export function detectMeetingType(title: string): KawanishiMeetingType {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function normalizeHtmlText(text: string): string {
  return normalizeDigits(text)
    .replace(/&nbsp;/g, " ")
    .replace(/&#x3000;|&#12288;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveUrl(href: string, baseUrl = `${BASE_ORIGIN}/`): string {
  return new URL(href, baseUrl).href;
}

function eraToWesternYear(era: string, eraYearText: string): number | null {
  const eraYear = eraYearText === "元" ? 1 : Number(eraYearText);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
}

export function parseWarekiYears(text: string): number[] {
  const normalized = normalizeDigits(text);
  const years: number[] = [];

  for (const match of normalized.matchAll(/(令和|平成|昭和)\s*(元|\d+)\s*年/g)) {
    const westernYear = eraToWesternYear(match[1]!, match[2]!);
    if (westernYear !== null) {
      years.push(westernYear);
    }
  }

  return years;
}

export function parseDateText(text: string): string | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(
    /(令和|平成|昭和)\s*(元|\d+)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/,
  );
  if (!match) return null;

  const westernYear = eraToWesternYear(match[1]!, match[2]!);
  if (westernYear === null) return null;

  const month = Number(match[3]);
  const day = Number(match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function matchesYearLink(linkText: string, year: number): boolean {
  const normalized = normalizeDigits(linkText);

  const westernYearMatches = Array.from(
    normalized.matchAll(/\b(20\d{2}|19\d{2})\s*年\b/g),
    (match) => Number(match[1]),
  );
  if (westernYearMatches.includes(year)) return true;

  const warekiYears = parseWarekiYears(normalized);
  if (warekiYears.includes(year)) return true;

  if (warekiYears.length >= 2 && /[～〜\-\/]/.test(normalized)) {
    const minYear = Math.min(...warekiYears);
    const maxYear = Math.max(...warekiYears);
    return minYear <= year && year <= maxYear;
  }

  return false;
}
