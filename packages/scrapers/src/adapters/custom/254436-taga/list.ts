/**
 * 多賀町議会 — list フェーズ
 *
 * 年度一覧ページ (category_list.php?frmCd=4-5-0-0-0) から年度別ページ URL を取得し、
 * 各年度ページから会議録 PDF リンクを収集する。
 *
 * 年度一覧ページの構造:
 *   <h2><a href="/category_list.php?frmCd=4-5-5-0-0">令和7年</a></h2>
 *   <li><a href="contents_detail.php?co=cat&frmId=2116&frmCd=4-5-5-0-0">会議録</a></li>
 *
 * 年度別ページの構造:
 *   <h2>定例会</h2>
 *   <div class="mol_attachfileblock">
 *     <p class="mol_attachfileblock_title"><strong>2月定例会</strong></p>
 *     <ul>
 *       <li><a href="./cmsfiles/contents/0000001/1997/20240202.pdf">2月2日開会</a></li>
 *     </ul>
 *   </div>
 *   <h2>臨時会</h2>
 *   <div class="mol_attachfileblock">
 *     <p class="mol_attachfileblock_title"><strong>4月臨時会</strong></p>
 *     <ul>
 *       <li><a href="./cmsfiles/contents/0000001/1997/20240410.pdf">4月臨時会</a></li>
 *     </ul>
 *   </div>
 */

import {
  CATEGORY_LIST_URL,
  buildHeldOn,
  detectMeetingType,
  extractDateFromFilename,
  extractMonthFromTitle,
  extractYearFromTitle,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface TagaMeetingRecord {
  /** 会議名（例: 令和6年2月定例会） */
  sessionTitle: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** PDF のリンクテキスト（例: 2月2日開会） */
  linkText: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日（YYYY-MM-DD）または null */
  heldOn: string | null;
  /** 年度ページの URL */
  yearPageUrl: string;
}

/**
 * 年度一覧ページ HTML から年度別ページの URL と年を抽出する（テスト可能な純粋関数）。
 *
 * h2 要素内のリンクテキスト（「令和X年」）から年を取得し、
 * 直後の li 内のリンク（contents_detail.php?co=cat&frmId=...）を年度別ページとして収集する。
 */
export function parseCategoryListPage(html: string): Array<{ url: string; year: number | null }> {
  const results: Array<{ url: string; year: number | null }> = [];
  const seen = new Set<string>();

  // h2 タグとリンクを順番に処理
  const elementPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi;

  let currentYear: number | null = null;

  for (const match of html.matchAll(elementPattern)) {
    const fullMatch = match[0]!;

    if (fullMatch.startsWith("<h2")) {
      // h2: 年度見出し（例: 令和7年）
      const rawTitle = (match[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      currentYear = extractYearFromTitle(rawTitle);
    } else {
      // a タグ: 年度別ページのリンクかチェック
      const href = match[2]!;

      if (!href.includes("contents_detail.php")) continue;
      if (!href.includes("frmId=")) continue;

      const absoluteUrl = resolveUrl(href);
      if (seen.has(absoluteUrl)) continue;
      seen.add(absoluteUrl);

      results.push({ url: absoluteUrl, year: currentYear });
    }
  }

  return results;
}

/**
 * 年度ページ HTML から会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 構造:
 *   h2: 会議種別（定例会/臨時会）
 *   p > strong: 月別セクション（例: 2月定例会、4月臨時会）
 *   ul > li > a: 各日の PDF リンク
 *
 * pageYear: 年度一覧ページから取得した西暦年（sessionTitle に使用）
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string,
  pageYear: number | null,
): TagaMeetingRecord[] {
  const results: TagaMeetingRecord[] = [];

  // h2 タグ、<strong>タグ、リンクを順番に処理
  const elementPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<strong[^>]*>([\s\S]*?)<\/strong>|<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentMeetingType = "plenary"; // デフォルト: 定例会
  let currentSessionLabel = ""; // 月別セクションラベル（例: 2月定例会）
  let inSection = false; // h2（定例会/臨時会）を検出したかどうか

  for (const match of html.matchAll(elementPattern)) {
    const fullMatch = match[0]!;

    if (fullMatch.startsWith("<h2")) {
      // h2: 会議種別（定例会/臨時会）
      const rawTitle = (match[1] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      // 「定例会」「臨時会」のみセクション開始とみなす
      if (rawTitle === "定例会" || rawTitle === "臨時会" || rawTitle.includes("委員会")) {
        currentMeetingType = detectMeetingType(rawTitle);
        currentSessionLabel = ""; // セクション変更時にリセット
        inSection = true;
      }
    } else if (fullMatch.startsWith("<strong")) {
      // strong: 月別セクション（例: 2月定例会）
      const rawLabel = (match[2] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (rawLabel) {
        currentSessionLabel = rawLabel;
      }
    } else {
      // a タグ: PDF リンクかチェック
      const href = match[3]!;
      const rawLinkText = (match[4] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      // ./cmsfiles/contents/ を含むリンクのみ収集
      if (!href.includes("cmsfiles/contents/")) continue;
      // .pdf で終わるものに限定
      if (!href.toLowerCase().endsWith(".pdf")) continue;
      // h3 セクションに入っていない場合はスキップ
      if (!inSection) continue;

      const pdfUrl = resolveUrl(href, yearPageUrl);
      // ファイル名・サイズ情報を除去（例: "2月2日開会 (ファイル名：20240202.pdf  サイズ：1.10MB)"）
      const linkText = (rawLinkText || href.split("/").pop() || "")
        .replace(/\s*\(ファイル名：[^)]*\)\s*/g, "")
        .trim();

      // セッションタイトルを構築（年 + 月別セクションラベル）
      let sessionTitle = "";
      if (pageYear && currentSessionLabel) {
        // 元号形式に変換: 2024 → 令和6年
        const reiwaYear = pageYear - 2018;
        sessionTitle = `令和${reiwaYear}年${currentSessionLabel}`;
      } else if (pageYear) {
        const reiwaYear = pageYear - 2018;
        sessionTitle = `令和${reiwaYear}年${currentMeetingType === "plenary" ? "定例会" : "臨時会"}`;
      } else {
        sessionTitle = currentSessionLabel || (currentMeetingType === "plenary" ? "定例会" : "臨時会");
      }

      // 開催日の推定: ファイル名 → リンクテキスト の順で試みる
      const fileName = pdfUrl.split("/").pop() ?? "";
      let heldOn = extractDateFromFilename(fileName);

      if (!heldOn && pageYear) {
        // リンクテキストから日付を試みる（例: "2月2日開会"）
        const linkDateMatch = linkText.match(/(\d+)月(\d+)日/);
        if (linkDateMatch) {
          const month = String(parseInt(linkDateMatch[1]!, 10)).padStart(2, "0");
          const day = String(parseInt(linkDateMatch[2]!, 10)).padStart(2, "0");
          heldOn = `${pageYear}-${month}-${day}`;
        }
      }

      if (!heldOn) {
        // セクションラベルから月を抽出
        const month = extractMonthFromTitle(currentSessionLabel);
        heldOn = pageYear ? buildHeldOn(pageYear, month) : null;
      }

      // meetingType を再計算（sessionTitle も利用）
      const meetingType = detectMeetingType(sessionTitle || currentSessionLabel);

      results.push({
        sessionTitle,
        pdfUrl,
        linkText,
        meetingType,
        heldOn,
        yearPageUrl,
      });
    }
  }

  return results;
}

/**
 * heldOn または sessionTitle から西暦年を取得する。
 */
export function extractYearFromRecord(record: TagaMeetingRecord): number | null {
  if (record.heldOn) {
    const match = record.heldOn.match(/^(\d{4})-/);
    if (match) return parseInt(match[1]!, 10);
  }
  return extractYearFromTitle(record.sessionTitle);
}

/**
 * 年度一覧ページから全年度ページの URL と年を取得する。
 */
export async function fetchYearPages(): Promise<Array<{ url: string; year: number | null }>> {
  const html = await fetchPage(CATEGORY_LIST_URL);
  if (!html) return [];
  return parseCategoryListPage(html);
}

/**
 * 指定年の会議録 PDF リンクを全年度ページから収集する。
 */
export async function fetchMeetingRecords(year: number): Promise<TagaMeetingRecord[]> {
  const yearPages = await fetchYearPages();
  if (yearPages.length === 0) return [];

  const allRecords: TagaMeetingRecord[] = [];

  for (const { url, year: pageYear } of yearPages) {
    // 年が特定できていて対象年でない場合はスキップ
    if (pageYear !== null && pageYear !== year) continue;

    const html = await fetchPage(url);
    if (!html) continue;

    const records = parseYearPage(html, url, pageYear);

    for (const record of records) {
      const recordYear = extractYearFromRecord(record);
      if (recordYear === null || recordYear === year) {
        allRecords.push(record);
      }
    }
  }

  return allRecords;
}
