/**
 * 川本町議会 会議録 — list フェーズ
 *
 * 会議録トップページから年度別ページ URL を取得し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 *
 * トップページ構造:
 *   <a href="/gyosei/.../kaigiroku/{pageId}">令和X年</a>
 *
 * 年度別ページ構造 (.contentBody):
 *   <h2>定例会</h2>
 *   <h3>第1回定例会</h3>
 *   <p>
 *     <a href="/files/original/{hash}.pdf">令和7年3月7日：初日</a>
 *   </p>
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  fetchPage,
  parseDateFromLinkText,
} from "./shared";

export interface KawamotoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第1回定例会 初日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
}

/**
 * 会議録トップページから年度別ページへのリンクを抽出する。
 * href が /kaigiroku/{pageId} 形式のリンクを抽出する。
 */
export function parseYearPageLinks(html: string): string[] {
  const urls: string[] = [];
  // kaigiroku/ 以降に pageId（数値またはスラッグ）を持つリンクを抽出
  const linkPattern =
    /<a[^>]+href="(\/gyosei\/town_administration\/kawamoto_council\/kaigiroku\/[^"/]+\/?)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const path = match[1]!;
    // トップページ自体は除外
    if (
      path === "/gyosei/town_administration/kawamoto_council/kaigiroku/" ||
      path === "/gyosei/town_administration/kawamoto_council/kaigiroku"
    ) {
      continue;
    }
    const fullUrl = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
  }

  return urls;
}

/**
 * 年度別ページの HTML から PDF リンクを抽出する。
 *
 * .contentBody 内の h2 (定例会/臨時会) と h3 (第N回定例会 等) を追跡し、
 * PDF リンクのリンクテキストから開催日と議事内容をパースする。
 *
 * @param html 年度別ページの HTML
 * @param year 対象年（西暦）フィルタ用
 */
export function parseYearPage(
  html: string,
  year: number,
): KawamotoMeeting[] {
  const results: KawamotoMeeting[] = [];

  // .contentBody を抽出
  const contentBodyMatch = html.match(
    /<div[^>]+class="[^"]*contentBody[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!contentBodyMatch) return results;

  const content = contentBodyMatch[1]!;

  // h2/h3/a[href$=".pdf"] を含むトークン列を解析
  // セクション状態を追跡しながら PDF リンクを収集する
  const tokenPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*>([\s\S]*?)<\/h3>|<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentMeetingKind = ""; // "定例会" or "臨時会"
  let currentSession = ""; // "第1回定例会" 等

  for (const match of content.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      // <h2>
      const h2Text = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      currentMeetingKind = h2Text;
      currentSession = "";
    } else if (match[2] !== undefined) {
      // <h3>
      const h3Text = match[2]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();
      currentSession = h3Text;
    } else if (match[3] !== undefined && match[4] !== undefined) {
      // <a href="*.pdf">
      const href = match[3]!;
      const rawText = match[4]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/\s+/g, " ")
        .trim();

      if (!rawText) continue;

      // 開催日をパース
      const heldOn = parseDateFromLinkText(rawText);

      // 臨時会パターン: "令和X年第N回臨時会議事録" は日付が取れないため特別処理
      // この場合は heldOn が null になる可能性がある
      if (!heldOn) continue;

      // 対象年フィルタ
      const meetingYear = parseInt(heldOn.slice(0, 4), 10);
      if (meetingYear !== year) continue;

      // リンクテキストからコンテンツ部分（コロン以降）を抽出
      // "令和7年3月7日：初日" → "初日"
      const contentPartMatch = rawText.match(/[：:]\s*(.+)$/);
      const contentPart = contentPartMatch?.[1]?.trim() ?? "";

      // タイトルを組み立て
      // currentSession: "第1回定例会"、contentPart: "初日" など
      let title: string;
      if (currentSession) {
        title = contentPart ? `${currentSession} ${contentPart}` : currentSession;
      } else if (currentMeetingKind) {
        title = contentPart
          ? `${currentMeetingKind} ${contentPart}`
          : currentMeetingKind;
      } else {
        title = rawText;
      }

      // PDF URL を組み立て
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href}`;

      // 重複チェック
      if (results.some((r) => r.pdfUrl === pdfUrl)) continue;

      results.push({ pdfUrl, title, heldOn });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * トップページから年度別ページ URL を収集し、各ページを巡回する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<KawamotoMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageLinks(topHtml);

  const allMeetings: KawamotoMeeting[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const meetings = parseYearPage(html, year);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
