/**
 * 飛騨市議会 -- list フェーズ
 *
 * 年度ページから PDF リンクと一般質問個人別ページを収集する。
 *
 * 構造（令和6年以降）:
 *   <h3>第4回定例会（11月26日～12月12日）</h3>
 *   <ul>
 *     <li><a href="/uploaded/attachment/28773.pdf">本会議（令和6年11月26日） [PDFファイル／483KB]</a></li>
 *   </ul>
 *   <p><a href="/site/gikai/68579.html">個人ごとの一般質問はこちら</a></p>
 *
 * 構造（平成29年以前）:
 *   <h2>第4回定例会（12月）</h2>
 *   <ul>
 *     <li><a href="/uploaded/attachment/3118.pdf">1日目（平成29年11月27日）[PDFファイル／631KB]</a></li>
 *   </ul>
 *
 * 一般質問個人別ページ:
 *   <table>
 *     <tr><td>番号</td><td>発言者名</td><td><a href="/uploaded/attachment/28548.pdf">会議録 [PDF]</a></td><td>...</td></tr>
 *   </table>
 */

import {
  BASE_ORIGIN,
  YEAR_PAGE_MAP,
  detectMeetingType,
  extractDateFromLinkText,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface HidaPdfLink {
  /** 会議タイトル（例: "本会議（令和6年11月26日）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 開催日 (YYYY-MM-DD) — リンクテキストから取得。取得不可の場合は null */
  heldOn: string | null;
  /** 一般質問の発言者名（個人別ページから取得した場合のみ） */
  speakerName: string | null;
  /** 所属する定例会/臨時会の見出し（例: "第4回定例会"） */
  sessionTitle: string;
}

/**
 * リンクテキストからタイトルを正規化する。
 * [PDFファイル／...] を除去し、全角数字を半角に変換する。
 */
export function normalizeLinkText(text: string): string {
  return toHalfWidth(
    text
      .replace(/\[PDFファイル[^\]]*\]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/**
 * href を絶対 URL に変換する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

/**
 * 見出しテキストからセッションタイトルを抽出する。
 * 「第4回定例会（11月26日～12月12日）」→「第4回定例会」
 */
export function extractSessionTitle(heading: string): string {
  const normalized = toHalfWidth(heading.trim());
  // 括弧以前の部分を取得（「第4回定例会」部分）
  const match = normalized.match(/^(第\d+回(?:定例会|臨時会))/);
  return match ? match[1]! : normalized;
}

/**
 * 一般質問個人別ページの HTML をパースして PDF リンクを取得する。
 * テーブル行ごとに発言者名と PDF URL をペアで返す。
 */
export function parseIppanShitsumonPage(
  html: string,
  sessionTitle: string,
): HidaPdfLink[] {
  const results: HidaPdfLink[] = [];

  // テーブル行を抽出
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm: RegExpExecArray | null;
  while ((rm = rowPattern.exec(html)) !== null) {
    const rowContent = rm[1]!;

    // PDF リンクを含む行のみ処理
    const pdfLinkMatch = rowContent.match(
      /<a\s[^>]*href="([^"]*\/uploaded\/attachment\/[^"]*\.pdf)"[^>]*>/i,
    );
    if (!pdfLinkMatch) continue;

    const pdfUrl = resolveUrl(pdfLinkMatch[1]!);

    // td を順番に取得して発言者名を抽出
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = tdPattern.exec(rowContent)) !== null) {
      cells.push(tm[1]!.replace(/<[^>]+>/g, "").trim());
    }

    // ヘッダー行（番号, 発言者, ...）をスキップ
    if (cells[0] === "番号" || cells[0] === "No") continue;

    // 2列目が発言者名
    const speakerName = cells[1]
      ? cells[1].replace(/[\s\u3000]+/g, "").trim()
      : null;
    if (!speakerName) continue;

    // 3列目の PDF リンクテキストからは日付取得が難しいため、
    // 4列目の発言日テキストから日付を取得する
    let heldOn: string | null = null;
    for (const cell of cells) {
      const date = extractDateFromLinkText(cell);
      if (date) {
        heldOn = date;
        break;
      }
    }

    results.push({
      title: `一般質問（${speakerName}）`,
      pdfUrl,
      meetingType: "plenary",
      heldOn,
      speakerName,
      sessionTitle,
    });
  }

  return results;
}

/**
 * 年度ページの HTML をパースして PDF リンクを収集する。
 * h2 または h3 の定例会/臨時会見出しと後続の ul 内 PDF リンクを紐付ける。
 */
export function parseYearPage(html: string): {
  pdfLinks: HidaPdfLink[];
  ippanShitsumonUrls: { url: string; sessionTitle: string }[];
} {
  const pdfLinks: HidaPdfLink[] = [];
  const ippanShitsumonUrls: { url: string; sessionTitle: string }[] = [];

  // h2 or h3 の見出しを取得（定例会/臨時会の見出し）
  const headingPattern =
    /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  const headings: { text: string; position: number; sessionTitle: string }[] =
    [];
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const innerText = toHalfWidth(hm[1]!.replace(/<[^>]+>/g, "").trim());
    // 定例会 or 臨時会の見出しのみ対象
    if (innerText.includes("定例会") || innerText.includes("臨時会")) {
      headings.push({
        text: innerText,
        position: hm.index,
        sessionTitle: extractSessionTitle(innerText),
      });
    }
  }

  // PDF リンクを抽出（/uploaded/attachment/*.pdf）
  const linkPattern =
    /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkPattern.exec(html)) !== null) {
    const linkPosition = lm.index;
    const href = lm[1]!;
    const linkText = lm[2]!.replace(/<[^>]+>/g, "").trim();

    // 直前の見出しを特定
    let currentHeading: (typeof headings)[0] | null = null;
    for (const h of headings) {
      if (h.position < linkPosition) {
        currentHeading = h;
      }
    }

    const title = normalizeLinkText(linkText);
    if (!title) continue;

    const pdfUrl = resolveUrl(href);
    const heldOn = extractDateFromLinkText(linkText);
    const sessionTitle = currentHeading?.sessionTitle ?? "";
    const meetingType = detectMeetingType(title);

    pdfLinks.push({
      title,
      pdfUrl,
      meetingType,
      heldOn,
      speakerName: null,
      sessionTitle,
    });
  }

  // 一般質問個人別ページへのリンクを収集
  const ippanPattern =
    /<a\s[^>]*href="(\/site\/gikai\/\d+\.html)"[^>]*>[^<]*個人ごとの一般質問[^<]*<\/a>/gi;
  let im: RegExpExecArray | null;
  while ((im = ippanPattern.exec(html)) !== null) {
    const linkPosition = im.index;
    const url = resolveUrl(im[1]!);

    // 直前の見出しを特定
    let currentHeading: (typeof headings)[0] | null = null;
    for (const h of headings) {
      if (h.position < linkPosition) {
        currentHeading = h;
      }
    }

    ippanShitsumonUrls.push({
      url,
      sessionTitle: currentHeading?.sessionTitle ?? "",
    });
  }

  return { pdfLinks, ippanShitsumonUrls };
}

/**
 * 指定年の PDF リンクを収集する。
 * 年度ページ＋一般質問個人別ページの PDF を統合して返す。
 */
export async function fetchDocumentList(
  year: number,
): Promise<HidaPdfLink[]> {
  const pageUrl = YEAR_PAGE_MAP[year];
  if (!pageUrl) return [];

  const html = await fetchPage(pageUrl);
  if (!html) return [];

  const { pdfLinks, ippanShitsumonUrls } = parseYearPage(html);

  // 一般質問個人別ページを取得
  for (let i = 0; i < ippanShitsumonUrls.length; i++) {
    const { url, sessionTitle } = ippanShitsumonUrls[i]!;
    const ippanHtml = await fetchPage(url);
    if (ippanHtml) {
      const ippanLinks = parseIppanShitsumonPage(ippanHtml, sessionTitle);
      pdfLinks.push(...ippanLinks);
    }
    if (i < ippanShitsumonUrls.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return pdfLinks;
}
