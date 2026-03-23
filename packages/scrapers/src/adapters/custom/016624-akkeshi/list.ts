/**
 * 厚岸町議会 会議録 — list フェーズ
 *
 * 年度別ページの HTML をパースして PDF リンクを収集する。
 *
 * HTML 構造:
 *   <h3>令和6年第1回定例会</h3>
 *   <h5>会期：令和6年3月6日～13日</h5>
 *   <h4>本会議</h4>
 *   <ul>
 *     <li><a href="/file/contents/.../r060306-honnkaigi.pdf">3月6日</a>(PDF形式：13MB)</li>
 *   </ul>
 *   <h4>予算審査特別委員会</h4>
 *   <ul>
 *     <li><a href="/file/contents/.../r060306-yosan.pdf">3月6日</a>(PDF形式：1MB)</li>
 *   </ul>
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  fetchPage,
} from "./shared";

export interface AkkeshiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第1回定例会 本会議"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** セッション名（例: "令和6年第1回定例会"） */
  sessionName: string;
  /** 会議種別（例: "本会議", "予算審査特別委員会"） */
  category: string;
}

/**
 * リンクテキストの日付（例: "3月6日"）と年を組み合わせて YYYY-MM-DD を生成する。
 */
function parseDateFromLinkText(
  linkText: string,
  year: number,
): string | null {
  const match = linkText.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * h3 見出しから年を抽出する（令和/平成 → 西暦）。
 * 例: "令和6年第1回定例会" → 2024
 *     "平成31年第1回定例会" → 2019
 */
function extractYearFromHeading(heading: string): number | null {
  const reiwaMatch = heading.match(/令和(\d+)年/);
  if (reiwaMatch) return parseInt(reiwaMatch[1]!, 10) + 2018;

  // 令和元年
  if (heading.includes("令和元年")) return 2019;

  const heiseiMatch = heading.match(/平成(\d+)年/);
  if (heiseiMatch) return parseInt(heiseiMatch[1]!, 10) + 1988;

  return null;
}

/**
 * 年度別ページ HTML から PDF 一覧をパースする。
 *
 * h3 でセッション名、h4 で会議種別を追跡しながら PDF リンクを収集する。
 */
export function parseYearPage(html: string, fallbackYear: number): AkkeshiMeeting[] {
  const meetings: AkkeshiMeeting[] = [];

  // HTML をタグ単位で走査して見出し状態を追跡する
  let currentSession = "";
  let currentCategory = "";
  let currentYear = fallbackYear;

  // 見出しと PDF リンクを順番に抽出する正規表現
  const tokenRegex =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<h4[^>]*>([\s\S]*?)<\/h4>|<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(tokenRegex)) {
    if (match[1] !== undefined) {
      // h3: セッション名（例: "令和6年第1回定例会"）
      currentSession = match[1].replace(/<[^>]+>/g, "").trim();
      currentCategory = "";
      const year = extractYearFromHeading(currentSession);
      if (year) currentYear = year;
    } else if (match[2] !== undefined) {
      // h4: 会議種別（例: "本会議", "予算審査特別委員会"）
      const cat = match[2].replace(/<[^>]+>/g, "").trim();
      // 「会期：」を含む場合は h5 相当の情報なのでスキップ
      if (!cat.startsWith("会期")) {
        currentCategory = cat;
      }
    } else if (match[3] !== undefined && match[4] !== undefined) {
      // PDF リンク
      const href = match[3];
      const linkText = match[4].replace(/<[^>]+>/g, "").trim();

      // PDF URL を構築
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

      // 日付をパース
      const heldOn = parseDateFromLinkText(linkText, currentYear);
      if (!heldOn) continue;

      // タイトルを組み立て
      const title = currentCategory
        ? `${currentSession} ${currentCategory}`
        : currentSession;

      // 重複チェック
      if (meetings.some((m) => m.pdfUrl === pdfUrl)) continue;

      meetings.push({
        pdfUrl,
        title,
        heldOn,
        sessionName: currentSession,
        category: currentCategory || "本会議",
      });
    }
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<AkkeshiMeeting[]> {
  const url = buildYearPageUrl(year);
  if (!url) return [];

  const html = await fetchPage(url);
  if (!html) return [];

  // h10_13 ページ（平成10〜13年）は複数年分が含まれるため、
  // 指定年のセッションのみをフィルタする
  const all = parseYearPage(html, year);

  // 年フィルタ: heldOn の年が指定年と一致するもののみ
  return all.filter((m) => m.heldOn.startsWith(String(year)));
}
