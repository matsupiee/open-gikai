/**
 * 高浜市議会 — list フェーズ
 *
 * 定例会・臨時会の単一ページと、委員会・特別委員会の一覧ページを巡回し、
 * PDF リンクを収集する。
 *
 * 定例会・臨時会:
 *   単一ページに全年度の PDF リンクが掲載される。
 *   h3 見出し + id 属性で年度セクション分割（例: #r7, #r6, #h30）。
 *
 * 委員会・特別委員会:
 *   一覧ページから個別ページ URL を取得し、各ページの PDF を収集する。
 *
 * リンクテキストの形式:
 *   定例会: 第1日  11月25日 [PDF413KB]
 *   臨時会: 第1日  1月30日 [PDF310KB]
 *   委員会: 12月9日 総務建設委員会 [PDF282KB]
 */

import {
  IINKAI_INDEX_URL,
  RINJI_URL,
  TEIREIKAI_URL,
  TOKUBETSU_INDEX_URL,
  buildHeldOn,
  delay,
  extractYearMonth,
  fetchPage,
  resolveUrl,
} from "./shared";

export interface TakahamaMeetingLink {
  /** 会議タイトル */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日 (YYYY-MM-DD) */
  heldOn: string;
  /** ソース URL (一覧ページ or 個別ページ) */
  sourceUrl: string;
  /** 外部 ID（PDF URL から生成） */
  externalId: string;
}

/**
 * 定例会・臨時会ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * ページは h3 見出しで年度ごとにセクション分割されており、
 * 各セクション内の `/uploaded/attachment/{ID}.pdf` リンクを収集する。
 * リンクテキストと直近の h3 見出しから年・月情報を補完する。
 *
 * @param html ページの HTML 文字列
 * @param pageUrl このページの URL（ソース URL として使用）
 * @param defaultMeetingType 「plenary」または「extraordinary」
 */
export function parsePlenaryPage(
  html: string,
  pageUrl: string,
  defaultMeetingType: string,
): TakahamaMeetingLink[] {
  const results: TakahamaMeetingLink[] = [];

  // h3 見出しと PDF リンクを一緒にスキャンする
  // セクション見出し（年度）を追跡しながら直下の PDF リンクを収集する
  const tokenPattern =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<a[^>]+href="([^"]*\/uploaded\/attachment\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentYear = 0;
  let currentMonth: number | null = null;

  for (const match of html.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      // h3 見出し: 年度を更新
      const headingText = match[1].replace(/<[^>]*>/g, "").trim();
      const { year, month } = extractYearMonth(headingText);
      if (year) {
        currentYear = year;
        currentMonth = month;
      }
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // PDF リンク
      const href = match[2]!;
      const linkText = match[3]!.replace(/<[^>]*>/g, "").trim();

      const pdfUrl = resolveUrl(href);

      // リンクテキストから月を補完（例: 第1日  11月25日）
      const dateMatch = linkText.match(/(\d+)月(\d+)日/);
      let month = currentMonth;
      if (dateMatch) {
        month = parseInt(dateMatch[1]!, 10);
      }

      const heldOn = buildHeldOn(currentYear, month);
      const externalId = `takahama_${encodeURIComponent(pdfUrl)}`;

      // 委員会名が含まれる場合は committee に上書き
      const meetingType = linkText.includes("委員会") ? "committee" : defaultMeetingType;

      const title = buildTitle(linkText, currentYear, month, meetingType);

      results.push({
        title,
        pdfUrl,
        meetingType,
        heldOn,
        sourceUrl: pageUrl,
        externalId,
      });
    }
  }

  return results;
}

/**
 * 委員会・特別委員会一覧ページから個別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * `/site/gikai/{数値}.html` 形式のリンクを収集する（一覧ページ自体の URL は除外）。
 */
export function parseCommitteeIndexPage(html: string, indexUrl: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  // 一覧ページ自身のパスを除外するために path 部分を取得
  const indexPath = new URL(indexUrl).pathname;

  const linkPattern = /<a[^>]+href="([^"]*\/site\/gikai\/\d+\.html)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const url = resolveUrl(href);

    // 一覧ページ自体は除外
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.pathname === indexPath) continue;
    } catch {
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);
    results.push(url);
  }

  return results;
}

/**
 * 委員会個別ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * `/uploaded/attachment/{ID}.pdf` 形式のリンクを収集し、
 * リンクテキストから日付・委員会名を取得する。
 */
export function parseCommitteePage(
  html: string,
  pageUrl: string,
): TakahamaMeetingLink[] {
  const results: TakahamaMeetingLink[] = [];

  // ページタイトル（h1 や h2）から委員会名を取得
  const pageTitleMatch = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  const pageTitle = pageTitleMatch
    ? pageTitleMatch[1]!.replace(/<[^>]*>/g, "").trim()
    : "";

  const tokenPattern =
    /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<a[^>]+href="([^"]*\/uploaded\/attachment\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentYear = 0;
  let currentMonth: number | null = null;

  for (const match of html.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      const headingText = match[1].replace(/<[^>]*>/g, "").trim();
      const { year, month } = extractYearMonth(headingText);
      if (year) {
        currentYear = year;
        currentMonth = month;
      }
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const href = match[2]!;
      const linkText = match[3]!.replace(/<[^>]*>/g, "").trim();

      const pdfUrl = resolveUrl(href);

      const dateMatch = linkText.match(/(\d+)月(\d+)日/);
      let month = currentMonth;
      if (dateMatch) {
        month = parseInt(dateMatch[1]!, 10);
      }

      const heldOn = buildHeldOn(currentYear, month);
      const externalId = `takahama_${encodeURIComponent(pdfUrl)}`;

      // 委員会名の抽出: リンクテキストから取得し、なければページタイトルから補完
      const committeeMatch = linkText.match(/\d+月\d+日\s+(.+?委員会)/);
      const committeeNameFromText = committeeMatch ? committeeMatch[1]! : null;
      const committeeName = committeeNameFromText ?? pageTitle;

      const title = committeeName
        ? `${heldOn.slice(0, 7)} ${committeeName}`
        : buildTitle(linkText, currentYear, month, "committee");

      results.push({
        title,
        pdfUrl,
        meetingType: "committee",
        heldOn,
        sourceUrl: pageUrl,
        externalId,
      });
    }
  }

  return results;
}

/**
 * リンクテキストと年月から会議タイトルを構築する。
 */
function buildTitle(
  _linkText: string,
  year: number,
  month: number | null,
  meetingType: string,
): string {
  const yearStr = year ? `${year}年` : "";
  const monthStr = month ? `${month}月` : "";
  const prefix = `${yearStr}${monthStr}`;

  if (meetingType === "extraordinary") {
    return prefix ? `${prefix} 高浜市議会臨時会 会議録` : "高浜市議会臨時会 会議録";
  }
  if (meetingType === "committee") {
    return prefix ? `${prefix} 委員会 会議録` : "委員会 会議録";
  }
  return prefix ? `${prefix} 高浜市議会定例会 会議録` : "高浜市議会定例会 会議録";
}

/**
 * 定例会・臨時会の会議録を全件収集する。
 */
async function fetchPlenary(year: number): Promise<TakahamaMeetingLink[]> {
  const [teireikaiHtml, rinjiHtml] = await Promise.all([
    fetchPage(TEIREIKAI_URL),
    fetchPage(RINJI_URL),
  ]);

  const results: TakahamaMeetingLink[] = [];

  if (teireikaiHtml) {
    const links = parsePlenaryPage(teireikaiHtml, TEIREIKAI_URL, "plenary");
    results.push(...links.filter((l) => matchYear(l.heldOn, year)));
  }

  if (rinjiHtml) {
    const links = parsePlenaryPage(rinjiHtml, RINJI_URL, "extraordinary");
    results.push(...links.filter((l) => matchYear(l.heldOn, year)));
  }

  return results;
}

/**
 * 委員会・特別委員会の会議録を全件収集する（2段階取得）。
 */
async function fetchCommittees(year: number): Promise<TakahamaMeetingLink[]> {
  const results: TakahamaMeetingLink[] = [];

  for (const indexUrl of [IINKAI_INDEX_URL, TOKUBETSU_INDEX_URL]) {
    const indexHtml = await fetchPage(indexUrl);
    if (!indexHtml) continue;

    const committeePageUrls = parseCommitteeIndexPage(indexHtml, indexUrl);

    for (const pageUrl of committeePageUrls) {
      await delay(1000);
      const pageHtml = await fetchPage(pageUrl);
      if (!pageHtml) continue;

      const links = parseCommitteePage(pageHtml, pageUrl);
      results.push(...links.filter((l) => matchYear(l.heldOn, year)));
    }
  }

  return results;
}

/**
 * heldOn (YYYY-MM-DD) が指定年に合致するか判定する。
 */
function matchYear(heldOn: string, year: number): boolean {
  if (!heldOn) return false;
  return heldOn.startsWith(`${year}-`);
}

/**
 * 指定年の全会議録リンクを収集する。
 */
export async function fetchMeetingLinks(year: number): Promise<TakahamaMeetingLink[]> {
  const [plenary, committees] = await Promise.all([
    fetchPlenary(year),
    fetchCommittees(year),
  ]);

  // PDF URL による重複除去
  const seen = new Set<string>();
  const results: TakahamaMeetingLink[] = [];
  for (const link of [...plenary, ...committees]) {
    if (seen.has(link.pdfUrl)) continue;
    seen.add(link.pdfUrl);
    results.push(link);
  }

  return results;
}
