/**
 * 斜里町議会 — list フェーズ
 *
 * 2段階クロール構造:
 *
 * パターン A（令和6年・7年 = 2024〜2025）:
 *   年度ページ（r6giji.html 等）のテーブルから直接 PDF リンクを取得。
 *   会議録列が空の場合はスキップ。
 *
 * パターン B（令和5年以前 = 2023 以前）:
 *   年度ページ → 個別会議ページ → PDF リンク の順にクロール。
 *   個別会議ページの例: r4_3kaigi.html, r3-5-6.html, 0623-1.html
 *
 * 委員会:
 *   soumu.html, sangyou.html, kouhou.html, gikaiunei.html, tokubetu.html,
 *   zenin_r3.html などに直接 PDF リンクがある。
 *   ファイル名パターン: {YYMMDD}_kiroku{n}.pdf
 */

import {
  BASE_URL,
  buildYearPageUrl,
  detectMeetingType,
  fetchPage,
  isDirectPattern,
  parseJapaneseDate,
  parseDateFromKaigirokuFilename,
  parseDateFromKirokuFilename,
  stripHtml,
} from "./shared";

export interface ShariMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "3月定例会議 令和4年3月9日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary" / "committee"） */
  meetingType: string;
}

/**
 * 相対パスを絶対 URL に変換する。
 */
function resolveUrl(href: string, basePageUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${BASE_URL}${href}`;
  // 相対パス: basePageUrl のディレクトリを基準に解決
  const baseDir = basePageUrl.replace(/\/[^/]+$/, "");
  return `${baseDir}/${href}`;
}

/**
 * img/ 配下の PDF リンクを HTML から全て抽出する。
 */
export function extractPdfLinks(html: string): string[] {
  const links: string[] = [];
  const pattern = /href="(img\/[^"]+\.pdf)"/gi;
  for (const match of html.matchAll(pattern)) {
    links.push(match[1]!);
  }
  return links;
}

/**
 * 年度別一覧ページ（パターン A: 令和6年・7年）の HTML から
 * 会議録 PDF リンクを直接抽出する。
 *
 * テーブル構造（各 tr に会議名と PDF リンクが同居する）:
 *   <tr>
 *     <th class="col-title">3月定例会議</th>
 *     <td><a href="img/r6.3.4_nittei.pdf">...</a></td>
 *     <td>...</td>
 *     <td>...</td>
 *     <td><a href="img/kaigiroku_r6_3_4.pdf">会議録 令和6年3月4日</a></td>
 *   </tr>
 */
export function parseDirectListPage(html: string): ShariMeeting[] {
  const results: ShariMeeting[] = [];

  // テーブル行を抽出
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const rowHtml = trMatch[1]!;

    // img/kaigiroku_*.pdf リンクを探す（ない行はスキップ）
    const pdfMatch = rowHtml.match(/href="(img\/kaigiroku_[^"]+\.pdf)"/i);
    if (!pdfMatch) continue;

    const relPdf = pdfMatch[1]!;
    const pdfUrl = `${BASE_URL}/${relPdf}`;

    // th.col-title から会議名を取得（同じ行にある）
    const titleMatch = rowHtml.match(/<th[^>]*class="[^"]*col-title[^"]*"[^>]*>([\s\S]*?)<\/th>/i);
    // col-title がない場合は th 全般
    const thMatch = titleMatch || rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    const currentTitle = thMatch ? stripHtml(thMatch[1]!) : "";

    // PDF リンクのテキストから日付を解析
    // href="img/kaigiroku_*.pdf" の直後の > ... </a> を取得
    const pdfLinkTextMatch = rowHtml.match(
      /href="img\/kaigiroku_[^"]+\.pdf"[^>]*>([\s\S]*?)<\/a>/i,
    );
    const linkText = pdfLinkTextMatch ? stripHtml(pdfLinkTextMatch[1]!) : "";

    // リンクテキスト例: "会議録 令和6年3月4日（月）"
    let heldOn = parseJapaneseDate(linkText);

    // リンクテキストで取れない場合はファイル名から
    if (!heldOn) {
      const filenameMatch = relPdf.match(/([^/]+\.pdf)$/i);
      if (filenameMatch) {
        heldOn = parseDateFromKaigirokuFilename(filenameMatch[1]!);
      }
    }

    const title = currentTitle
      ? `${currentTitle}${heldOn ? " " + heldOn : ""}`
      : linkText || relPdf;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(currentTitle || title),
    });
  }

  return results;
}

/**
 * 年度別一覧ページ（パターン B: 令和3年以前）から個別会議ページへのリンクを抽出する。
 *
 * テーブル構造（2カラム）:
 *   th.col-title: 会議名 (例: "3月定例会議")
 *   td: 複数の <a href="r4_3kaigi.html">令和4年3月9日（水）</a> リンク
 *
 * 注意: 同一 td 内に同じ .html ページへの複数リンクがある場合は重複を排除する。
 */
export function parseYearListPageLinks(
  html: string,
  basePageUrl: string,
): { url: string; title: string; heldOn: string | null }[] {
  const results: { url: string; title: string; heldOn: string | null }[] = [];
  const seenUrls = new Set<string>();

  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;

  for (const trMatch of html.matchAll(trPattern)) {
    const rowHtml = trMatch[1]!;

    // ヘッダ行はスキップ（名称・開催日 の行）
    if (rowHtml.includes("名称") && rowHtml.includes("開催日")) continue;

    // th.col-title から会議名を取得
    const thMatch = rowHtml.match(/<th[^>]*class="[^"]*col-title[^"]*"[^>]*>([\s\S]*?)<\/th>/i);
    if (!thMatch) continue;

    const meetingName = stripHtml(thMatch[1]!);
    // 空白や空文字はスキップ
    if (!meetingName || !meetingName.trim()) continue;

    // td 内の全 .html リンクを取得
    const tdMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    if (!tdMatch) continue;
    const tdHtml = tdMatch[1]!;

    const linkPattern = /<a\s+[^>]*href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const linkMatch of tdHtml.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const linkText = stripHtml(linkMatch[2]!);

      // 外部リンクはスキップ
      if (href.startsWith("http") && !href.includes("gikai-sharitown.net")) continue;

      // 年度ページ自身へのリンクはスキップ
      if (href.endsWith("giji.html") || /^[rh]\d*giji\.html$/.test(href)) continue;

      // question_ などの別コンテンツページはスキップ（optional: 一般質問ページなど）
      if (href.startsWith("question_")) continue;

      // アンカーリンク付きのものはアンカーを除去して正規化
      const cleanHref = href.replace(/#.*$/, "");
      const url = resolveUrl(cleanHref, basePageUrl);

      // 同一 URL の重複を排除
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);

      const heldOn = parseJapaneseDate(linkText);
      const title = `${meetingName}${linkText ? " " + linkText : ""}`.trim();

      results.push({ url, title, heldOn });
    }
  }

  return results;
}

/**
 * 個別会議ページ（パターン B）から会議録 PDF リンクを抽出する。
 *
 * テーブル構造:
 *   日程 | 議件番号 | 議件名・議案 | 議決結果等 | 中継録画 | 会議録
 *   最後の td に <a href="img/kaigiroku_*.pdf"> がある
 */
export function parseIndividualMeetingPage(
  html: string,
  fallbackTitle: string,
  fallbackHeldOn: string | null,
): ShariMeeting[] {
  const results: ShariMeeting[] = [];

  // img/kaigiroku_*.pdf リンクを探す
  const pdfPattern = /href="(img\/kaigiroku_[^"]+\.pdf)"/gi;
  const seenPdfs = new Set<string>();

  for (const match of html.matchAll(pdfPattern)) {
    const relPdf = match[1]!;
    if (seenPdfs.has(relPdf)) continue;
    seenPdfs.add(relPdf);

    const pdfUrl = `${BASE_URL}/${relPdf}`;

    // リンクを含む行のテキストからタイトルと日付を取得
    const linkContext = html.slice(
      Math.max(0, match.index! - 200),
      match.index! + 200,
    );
    const linkTextMatch = linkContext.match(/href="[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const linkText = linkTextMatch ? stripHtml(linkTextMatch[1]!) : "";

    // リンクテキスト: "会議録 令和3年5月6日（木）"
    let heldOn = parseJapaneseDate(linkText);

    // ファイル名から日付を解析（フォールバック）
    if (!heldOn) {
      const filenameMatch = relPdf.match(/([^/]+\.pdf)$/i);
      if (filenameMatch) {
        heldOn = parseDateFromKaigirokuFilename(filenameMatch[1]!);
      }
    }

    if (!heldOn) heldOn = fallbackHeldOn;

    const title = fallbackTitle || linkText || relPdf;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(fallbackTitle || ""),
    });
  }

  return results;
}

/**
 * 委員会ページ（soumu.html 等）から会議記録 PDF リンクを抽出する。
 *
 * ファイル名パターン: img/{YYMMDD}_kiroku{n}.pdf
 */
export function parseCommitteePage(
  html: string,
  committeeTitle: string,
): ShariMeeting[] {
  const results: ShariMeeting[] = [];
  const seenPdfs = new Set<string>();

  const pattern = /href="(img\/(\d{6}_kiroku\d*\.pdf))"/gi;
  for (const match of html.matchAll(pattern)) {
    const relPdf = match[1]!;
    const filename = match[2]!;

    if (seenPdfs.has(relPdf)) continue;
    seenPdfs.add(relPdf);

    const pdfUrl = `${BASE_URL}/${relPdf}`;
    const heldOn = parseDateFromKirokuFilename(filename);

    const title = `${committeeTitle}${heldOn ? " " + heldOn : ""}`;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: "committee",
    });
  }

  return results;
}

/**
 * 委員会ページ URL 一覧と会議名のマッピング
 */
const COMMITTEE_PAGES: { path: string; title: string }[] = [
  { path: "soumu.html", title: "総務文教常任委員会" },
  { path: "sangyou.html", title: "産業厚生常任委員会" },
  { path: "kouhou.html", title: "議会広報常任委員会" },
  { path: "gikaiunei.html", title: "議会運営委員会" },
  { path: "tokubetu.html", title: "特別委員会" },
  { path: "zenin_r3.html", title: "全員協議会" },
];

/**
 * 全委員会ページから指定年の会議録 PDF リストを取得する。
 */
async function fetchCommitteeMeetings(year: number): Promise<ShariMeeting[]> {
  const allMeetings: ShariMeeting[] = [];

  for (const { path, title } of COMMITTEE_PAGES) {
    const url = `${BASE_URL}/${path}`;
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseCommitteePage(html, title);
    // 指定年でフィルタ
    const filtered = meetings.filter((m) => {
      if (!m.heldOn) return false;
      return parseInt(m.heldOn.slice(0, 4), 10) === year;
    });
    allMeetings.push(...filtered);
  }

  return allMeetings;
}

/**
 * 指定年の会議一覧を取得する。
 * 本会議（年度ページ）と委員会ページの両方をクロールする。
 */
export async function fetchMeetingList(year: number): Promise<ShariMeeting[]> {
  const allMeetings: ShariMeeting[] = [];

  const yearPageUrl = buildYearPageUrl(year);
  if (yearPageUrl) {
    const html = await fetchPage(yearPageUrl);
    if (html) {
      if (isDirectPattern(year)) {
        // パターン A: 年度ページから直接 PDF リンクを取得
        const meetings = parseDirectListPage(html);
        // 指定年でフィルタ（年度ページは5月〜翌4月なので少し緩めにフィルタ）
        const filtered = meetings.filter((m) => {
          if (!m.heldOn) return true; // 日付不明は残す
          const y = parseInt(m.heldOn.slice(0, 4), 10);
          // 年度は year〜year+1 にまたがる
          return y === year || y === year + 1;
        });
        allMeetings.push(...filtered);
      } else {
        // パターン B: 個別会議ページへのリンクを収集してクロール
        const links = parseYearListPageLinks(html, yearPageUrl);
        for (const { url, title, heldOn } of links) {
          const pageHtml = await fetchPage(url);
          if (!pageHtml) continue;
          const meetings = parseIndividualMeetingPage(pageHtml, title, heldOn);
          allMeetings.push(...meetings);
        }
      }
    }
  }

  // 委員会ページも取得
  const committeeMeetings = await fetchCommitteeMeetings(year);
  allMeetings.push(...committeeMeetings);

  return allMeetings;
}
