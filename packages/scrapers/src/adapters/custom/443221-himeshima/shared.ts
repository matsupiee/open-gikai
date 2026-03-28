/**
 * 姫島村議会 — 共通ユーティリティ
 *
 * サイト: https://www.himeshima.jp/about/son-gikai/
 * 現状確認できる公開 PDF は議員名簿・議会構成などの案内資料のみで、
 * 発言全文の会議録は見当たらない。
 */

export const BASE_ORIGIN = "https://www.himeshima.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

const NON_MEETING_DOCUMENT_LABELS = [
  "議員名簿",
  "議長・副議長",
  "議会構成一覧表",
];

export type DocumentKind = "minutes" | "agenda" | "question-notice" | "other";

export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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

function eraToWestern(era: string, eraYearText: string): number | null {
  const eraYear = eraYearText === "元" ? 1 : Number(eraYearText);
  if (Number.isNaN(eraYear)) return null;
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

export function extractYearFromText(text: string): number | null {
  const eraMatch = text.match(/(令和|平成)(元|\d+)年/);
  if (eraMatch) {
    return eraToWestern(eraMatch[1]!, eraMatch[2]!);
  }

  const westernMatch = text.match(/(20\d{2})年/);
  if (westernMatch) return Number(westernMatch[1]!);

  const compactDateMatch = text.match(
    /(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?=[^0-9]|$)/
  );
  if (compactDateMatch) return Number(compactDateMatch[1]!);

  return null;
}

export function parseDateText(text: string): string | null {
  const eraMatch = text.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (eraMatch) {
    const westernYear = eraToWestern(eraMatch[1]!, eraMatch[2]!);
    if (!westernYear) return null;

    return `${westernYear}-${String(Number(eraMatch[3]!)).padStart(2, "0")}-${String(
      Number(eraMatch[4]!)
    ).padStart(2, "0")}`;
  }

  const westernMatch = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  if (westernMatch) {
    return `${westernMatch[1]!}-${String(Number(westernMatch[2]!)).padStart(
      2,
      "0"
    )}-${String(Number(westernMatch[3]!)).padStart(2, "0")}`;
  }

  const compactDateMatch = text.match(
    /(?:^|[^0-9])(20\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])(?=[^0-9]|$)/
  );
  if (!compactDateMatch) return null;

  return `${compactDateMatch[1]!}-${compactDateMatch[2]!}-${compactDateMatch[3]!}`;
}

export function classifyDocumentKind(title: string, pdfUrl: string): DocumentKind {
  const text = `${title} ${pdfUrl}`;

  if (/会議録|議事録|議会だより|審議結果/.test(text)) return "minutes";
  if (/一般質問|質問通告/.test(text)) return "question-notice";
  if (/議案|議事日程|日程/.test(text)) return "agenda";
  return "other";
}

export function isMeetingRelatedDocument(title: string, pdfUrl: string): boolean {
  if (NON_MEETING_DOCUMENT_LABELS.some((label) => title.includes(label))) return false;

  return /(定例会|臨時会|委員会|一般質問|質問通告|議案|議事日程|会議録|議事録|議会だより|審議結果)/.test(
    `${title} ${pdfUrl}`
  );
}
