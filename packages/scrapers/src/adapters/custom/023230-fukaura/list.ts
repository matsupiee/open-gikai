/**
 * 深浦町議会 — list フェーズ
 *
 * インデックスページ (/doc/2024090200018/) から年度別に定例会・臨時会の
 * リンクを収集し、各記事ページから一般質問 PDF の URL を取得する。
 *
 * 構造:
 *   インデックスページ（h2 年度見出し + リンク一覧）
 *   → 個別記事ページ（会期日程 + 議決結果 PDF + 一般質問 PDF リンク）
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  fetchPage,
  toReiwaYear,
  extractDocId,
} from "./shared";

export interface FukauraMeeting {
  /** 定例会・臨時会の名称 */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 個別記事ページの URL */
  articleUrl: string;
  /** 一般質問 PDF の絶対 URL リスト */
  questionPdfUrls: string[];
  /** 記事 ID（externalId 用） */
  docId: string;
}

/**
 * インデックスページから年度セクション内のリンクを抽出する（純粋関数）。
 *
 * @param html - インデックスページの HTML
 * @param year - 対象西暦年（年度の開始年）
 * @returns 各記事の URL・タイトル・開催日の配列
 */
export function parseIndexPage(
  html: string,
  year: number,
): { articleUrl: string; title: string; heldOn: string; docId: string }[] {
  const results: {
    articleUrl: string;
    title: string;
    heldOn: string;
    docId: string;
  }[] = [];

  const reiwaYear = toReiwaYear(year);

  // h2 見出しの位置を収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const sections: { index: number; reiwaYear: number | null }[] = [];

  for (const match of html.matchAll(h2Pattern)) {
    const headingText = match[1]!.replace(/<[^>]+>/g, "").trim();
    const yearMatch = headingText.match(/令和[（(]?(\d+|[０-９]+)[）)]?年/);
    if (yearMatch) {
      const ry = parseInt(
        yearMatch[1]!.replace(/[０-９]/g, (c) =>
          String("０１２３４５６７８９".indexOf(c)),
        ),
        10,
      );
      sections.push({ index: match.index!, reiwaYear: ry });
    } else {
      sections.push({ index: match.index!, reiwaYear: null });
    }
  }

  // リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*\/doc\/\d+\/?)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index!;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // このリンクが属する h2 セクションの年度を特定
    let sectionReiwaYear: number | null = null;
    for (const section of sections) {
      if (section.index < linkIndex) {
        sectionReiwaYear = section.reiwaYear;
      }
    }

    if (sectionReiwaYear !== reiwaYear) continue;

    // 開催日を抽出
    const heldOn = parseDateFromTitle(linkText);
    if (!heldOn) continue;

    const docId = extractDocId(href);
    if (!docId) continue;

    const articleUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({ articleUrl, title: linkText, heldOn, docId });
  }

  return results;
}

/**
 * リンクテキストから開催日を抽出して YYYY-MM-DD を返す。
 *
 * 対応パターン:
 *   令和8年3月第143回定例会（令和8年3月6日～13日）
 *   第142回臨時会（令和8年1月30日）
 *   令和7年12月第141回定例会（令和7年12月5日～9日）
 *   第139回定例会（令和7年6月4日～11日）
 *
 * カッコ内の日付を優先し、なければタイトル中の年月から推定。
 */
export function parseDateFromTitle(text: string): string | null {
  // カッコ内の日付パターン（令和N年M月D日）
  const parenMatch = text.match(
    /[（(]令和[（(]?(\d+|[０-９]+)[）)]?年(\d+|[０-９]+)月(\d+|[０-９]+)日/,
  );
  if (parenMatch) {
    const reiwaYear = normalizeNumber(parenMatch[1]!);
    const month = normalizeNumber(parenMatch[2]!);
    const day = normalizeNumber(parenMatch[3]!);
    const westernYear = reiwaYear + 2018;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // タイトル先頭の日付パターン（令和N年M月）
  const headerMatch = text.match(
    /令和[（(]?(\d+|[０-９]+)[）)]?年(\d+|[０-９]+)月/,
  );
  if (headerMatch) {
    const reiwaYear = normalizeNumber(headerMatch[1]!);
    const month = normalizeNumber(headerMatch[2]!);
    const westernYear = reiwaYear + 2018;
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 個別記事ページの HTML から一般質問 PDF の URL を抽出する（純粋関数）。
 *
 * 一般質問セクション配下の議員名付き PDF リンクを返す。
 * 概要 PDF（「一般質問わが町の～」）は目次的なので除外する。
 * 採決結果 PDF も除外する。
 */
export function parseArticlePdfLinks(
  html: string,
  articleUrl: string,
): string[] {
  const pdfUrls: string[] = [];

  // file_contents を含む PDF リンクを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*file_contents[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 採決結果 PDF を除外
    if (linkText.includes("採決結果")) continue;

    // 概要 PDF（「一般質問わが町のここが聞きたい」）を除外
    if (
      linkText.includes("一般質問") &&
      linkText.includes("わが町")
    )
      continue;

    // 議員名付き PDF のみ対象（「○○議員」パターン）
    if (!linkText.includes("議員")) continue;

    // 絶対 URL 構築
    const baseDir = articleUrl.endsWith("/")
      ? articleUrl
      : `${articleUrl}/`;
    const pdfUrl = href.startsWith("http")
      ? href
      : `${baseDir}${href}`;

    pdfUrls.push(pdfUrl);
  }

  return pdfUrls;
}

/** 全角数字を半角に変換して parseInt */
function normalizeNumber(s: string): number {
  const normalized = s.replace(/[０-９]/g, (c) =>
    String("０１２３４５６７８９".indexOf(c)),
  );
  return parseInt(normalized, 10);
}

/**
 * 指定年度の全記事を取得し、各記事ページから一般質問 PDF の URL を収集する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<FukauraMeeting[]> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];

  const entries = parseIndexPage(html, year);
  const meetings: FukauraMeeting[] = [];

  for (const entry of entries) {
    // レート制限: 1 秒待機
    await new Promise((r) => setTimeout(r, 1000));

    const articleHtml = await fetchPage(entry.articleUrl);
    if (!articleHtml) continue;

    const questionPdfUrls = parseArticlePdfLinks(
      articleHtml,
      entry.articleUrl,
    );

    // 一般質問 PDF がない場合でも記事自体は返す（議決結果のみのケース）
    meetings.push({
      title: entry.title,
      heldOn: entry.heldOn,
      articleUrl: entry.articleUrl,
      questionPdfUrls,
      docId: entry.docId,
    });
  }

  return meetings;
}
