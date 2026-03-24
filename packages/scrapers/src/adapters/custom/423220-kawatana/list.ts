/**
 * 川棚町議会 会議録 — list フェーズ
 *
 * トップページから年度別の定例会・臨時会ページURLを収集し、
 * 各ページから PDF リンクのメタ情報を収集する。
 */

import { TOP_URL, BASE_ORIGIN, fetchPage, toWesternYear, buildDate, parseJapaneseNumber } from "./shared";

export interface KawatanaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（リンクテキストから生成） */
  title: string;
  /** 開催日 YYYY-MM-DD (月初日) */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary";
  /** 外部 ID */
  externalId: string;
}

/** リンクテキストからファイルサイズ表記を除去して正規化する */
function normalizeLinkText(text: string): string {
  return text
    .replace(/\s*\([\d.]+\s*KB\)\s*$/i, "")  // "(351.6 KB)" を除去
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 定例会ページのリンクテキストをパース
 * 例: "令和６年１２月　定例会（３日目）(351.6 KB)"
 * 全角数字の月にも対応。
 */
export function parseTeireiLinkText(text: string): {
  heldOn: string | null;
  title: string;
  meetingType: "plenary";
} | null {
  // 全角・半角数字に対応: [０-９\d]
  const m = text.match(/^(令和|平成|昭和)([０-９\d元]+?)年([０-９\d]+)月[\s　]*定例会/);
  if (!m) return null;
  const era = m[1]!;
  const yearStr = m[2]!;
  const monthNum = parseJapaneseNumber(m[3]!);
  if (monthNum === null) return null;

  const westernYear = toWesternYear(era, yearStr);
  const heldOn = westernYear !== null ? buildDate(westernYear, monthNum) : null;

  const title = normalizeLinkText(text);

  return { heldOn, title, meetingType: "plenary" };
}

/**
 * 臨時会ページのリンクテキストをパース
 * 例: "令和６年１１月　臨時会(373.1 KB)"
 * 全角数字の月にも対応。
 */
export function parseRinjiLinkText(text: string): {
  heldOn: string | null;
  title: string;
  meetingType: "extraordinary";
} | null {
  const m = text.match(/^(令和|平成|昭和)([０-９\d元]+?)年([０-９\d]+)月[\s　]*臨時会/);
  if (!m) return null;
  const era = m[1]!;
  const yearStr = m[2]!;
  const monthNum = parseJapaneseNumber(m[3]!);
  if (monthNum === null) return null;

  const westernYear = toWesternYear(era, yearStr);
  const heldOn = westernYear !== null ? buildDate(westernYear, monthNum) : null;

  const title = normalizeLinkText(text);

  return { heldOn, title, meetingType: "extraordinary" };
}

/**
 * トップページの HTML から各年度の定例会・臨時会ページの URL を抽出する。
 * 返り値: { url, meetingType }[]
 */
export function parseTopPage(html: string): Array<{
  url: string;
  meetingType: "plenary" | "extraordinary";
}> {
  const results: Array<{ url: string; meetingType: "plenary" | "extraordinary" }> = [];

  // <a href="...">テキスト</a> を抽出
  const linkRegex = /<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  for (const m of html.matchAll(linkRegex)) {
    const href = m[1]!.trim();
    const text = m[2]!.trim();

    if (!text.includes("定例会") && !text.includes("臨時会")) continue;

    // 絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス: ../../../parliament/record/... など
      url = new URL(href, TOP_URL).href;
    }

    const meetingType: "plenary" | "extraordinary" = text.includes("定例会")
      ? "plenary"
      : "extraordinary";

    results.push({ url, meetingType });
  }

  return results;
}

/**
 * 定例会または臨時会ページの HTML から PDF リンクと対応するリンクテキストを抽出する。
 */
export function parseMeetingPage(
  html: string,
  meetingType: "plenary" | "extraordinary",
  pageUrl: string,
): KawatanaMeeting[] {
  const meetings: KawatanaMeeting[] = [];

  // リンクテキスト内に <i class="fas fa-file-pdf"></i> 等の HTML タグが含まれることがある
  // ため、タグを除去してプレーンテキストを取得する
  const linkRegex = /<a\s+href=["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(linkRegex)) {
    const href = m[1]!.trim();
    const rawInner = m[2]!;
    // HTML タグを除去してプレーンテキスト化
    const text = rawInner.replace(/<[^>]+>/g, "").trim();

    // PDF の絶対 URL
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = new URL(href, pageUrl).href;
    }

    let parsed: ReturnType<typeof parseTeireiLinkText> | ReturnType<typeof parseRinjiLinkText> | null = null;
    if (meetingType === "plenary") {
      parsed = parseTeireiLinkText(text);
    } else {
      parsed = parseRinjiLinkText(text);
    }

    if (!parsed) continue;

    // externalId は PDF の URL のパス部分から生成
    const urlPath = new URL(pdfUrl).pathname;
    const externalId = `kawatana_${urlPath.replace(/[^a-zA-Z0-9_]/g, "_")}`;

    meetings.push({
      pdfUrl,
      title: parsed.title,
      heldOn: parsed.heldOn,
      meetingType: parsed.meetingType,
      externalId,
    });
  }

  return meetings;
}

/**
 * 指定年の全 PDF メタ情報を収集する。
 */
export async function fetchMeetingList(year: number): Promise<KawatanaMeeting[]> {
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const allMeetings: KawatanaMeeting[] = [];
  const seenExternalIds = new Set<string>();

  for (const { url, meetingType } of yearPages) {
    const pageHtml = await fetchPage(url);
    if (!pageHtml) continue;

    const meetings = parseMeetingPage(pageHtml, meetingType, url);

    for (const meeting of meetings) {
      // year フィルタ: heldOn が指定年と一致するものだけ
      if (meeting.heldOn) {
        const meetingYear = parseInt(meeting.heldOn.slice(0, 4), 10);
        if (meetingYear !== year) continue;
      }

      if (!seenExternalIds.has(meeting.externalId)) {
        seenExternalIds.add(meeting.externalId);
        allMeetings.push(meeting);
      }
    }
  }

  return allMeetings;
}
