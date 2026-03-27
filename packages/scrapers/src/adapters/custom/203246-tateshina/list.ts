/**
 * 立科町議会 -- list フェーズ
 *
 * 3 階層構造:
 *   会議録トップ (kaigiroku/index.html)
 *     └─ 年度別一覧 ({年度スラグ}/index.html)
 *          └─ 定例会ページ ({年度スラグ}/{ページID}.html)
 *               └─ PDF ファイル (a.pdf セレクタ)
 *
 * 年度スラグに規則性がないため、トップページから動的に取得する。
 */

import {
  BASE_ORIGIN,
  KAIGIROKU_TOP_URL,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toHankaku,
  delay,
} from "./shared";

export interface TateshinaSessionInfo {
  /** 会議タイトル（例: "令和7年第1回"） */
  title: string;
  /** 西暦年（例: 2025） */
  year: number;
  /** 定例会ページの URL */
  sessionPageUrl: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** PDF リンクテキスト（例: "3月4日本会議開会・町長招集挨拶・議案上程・提案説明"） */
  pdfLinkText: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議を一意に識別するキー */
  sessionKey: string;
}

/**
 * 会議録トップページから年度別ページの URL を抽出する。
 *
 * セレクタ: ul.level1col2 li.dir a
 * 例: href="/gyoseijoho/gikai/kaigiroku/2335/index.html"
 */
export function parseYearPageUrls(html: string): string[] {
  const urls: string[] = [];
  // li 内の a タグを抽出（href に kaigiroku/ を含む index.html）
  const pattern =
    /<li[^>]*>[\s\S]*?<a\s+href="([^"]*kaigiroku\/[^"]+\/index\.html)"[^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度別一覧ページから定例会ページのリンクとタイトルを抽出する。
 *
 * セレクタ: ul.level1col2 li a（index.html 以外）
 * 例: href="/gyoseijoho/gikai/kaigiroku/2335/2520.html"
 */
export function parseSessionLinks(
  html: string,
  yearSlug: string
): Array<{ url: string; title: string }> {
  const links: Array<{ url: string; title: string }> = [];

  // kaigiroku/{yearSlug}/{ページID}.html パターン（index.html を除く）
  const escaped = yearSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `href="(/gyoseijoho/gikai/kaigiroku/${escaped}/(?!index)[^"]+\\.html)"[^>]*>([^<]+)<`,
    "gi"
  );

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawTitle = m[2]!
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const url = `${BASE_ORIGIN}${href}`;
    if (!links.some((l) => l.url === url)) {
      links.push({ url, title: rawTitle });
    }
  }

  return links;
}

/**
 * 定例会ページから PDF リンクを抽出する。
 *
 * セレクタ: a.pdf
 * 例: href="//www.town.tateshina.nagano.jp/material/files/group/3/R7teireikai1-01.pdf"
 * 返す値: { url: string; text: string }
 */
export function parsePdfLinks(
  html: string
): Array<{ url: string; text: string }> {
  const links: Array<{ url: string; text: string }> = [];

  // href が .pdf で終わる a タグを抽出
  const pattern =
    /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const rawText = m[2]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // プロトコル相対 URL（//www.town...）に https: を付与
    let url: string;
    if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("http")) {
      url = href;
    } else {
      url = `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    }

    links.push({ url, text: rawText });
  }

  return links;
}

/**
 * 定例会ページの h1 タイトルから会議情報を抽出する。
 * 例: "令和7年第1回" → { year: 2025, sessionNum: 1 }
 */
export function parseSessionTitle(html: string): {
  year: number | null;
  sessionNum: number | null;
  rawTitle: string;
} {
  const h1Match = html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    return { year: null, sessionNum: null, rawTitle: "" };
  }

  const rawTitle = h1Match[1]!
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const normalized = toHankaku(rawTitle);
  const year = parseWarekiYear(normalized);

  const numMatch = normalized.match(/第(\d+)回/);
  const sessionNum = numMatch ? parseInt(numMatch[1]!, 10) : null;

  return { year, sessionNum, rawTitle };
}

/**
 * 指定年の全セッション情報を取得する。
 *
 * 会議録トップ → 年度別一覧 → 定例会ページ → PDF リンクの 3 段階クロール。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<TateshinaSessionInfo[]> {
  const topHtml = await fetchPage(KAIGIROKU_TOP_URL);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml);
  const sessions: TateshinaSessionInfo[] = [];

  for (const yearPageUrl of yearPageUrls) {
    await delay(1500);

    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    // 年度スラグを URL から抽出
    const slugMatch = yearPageUrl.match(/kaigiroku\/([^/]+)\/index\.html$/);
    if (!slugMatch) continue;
    const yearSlug = slugMatch[1]!;

    const sessionLinks = parseSessionLinks(yearHtml, yearSlug);

    for (const { url: sessionPageUrl, title: rawPageTitle } of sessionLinks) {
      await delay(1500);

      const sessionHtml = await fetchPage(sessionPageUrl);
      if (!sessionHtml) continue;

      const { year: titleYear, sessionNum, rawTitle } = parseSessionTitle(sessionHtml);

      // タイトルから年が取得できない場合はリンクテキストから試みる
      const effectiveYear = titleYear ?? parseWarekiYear(toHankaku(rawPageTitle));
      if (effectiveYear !== year) continue;

      const pdfLinks = parsePdfLinks(sessionHtml);

      const sessionTitle = rawTitle || rawPageTitle;

      for (let i = 0; i < pdfLinks.length; i++) {
        const { url: pdfUrl, text: pdfLinkText } = pdfLinks[i]!;
        const fileNameMatch = pdfUrl.match(/\/([^/]+\.pdf)$/);
        const fileName = fileNameMatch ? fileNameMatch[1]! : `${i}`;
        const sessionKey = `tateshina_${year}_${yearSlug}_${sessionNum ?? "0"}_${fileName}`;

        sessions.push({
          title: sessionTitle,
          year,
          sessionPageUrl,
          pdfUrl,
          pdfLinkText,
          meetingType: detectMeetingType(sessionTitle),
          sessionKey,
        });
      }
    }
  }

  return sessions;
}
