/**
 * 甘楽町議会 — list フェーズ
 *
 * 1. トップページから年度別ページ URL を取得
 * 2. 対象年の年度ページから会議詳細ページのリンク一覧を取得
 * 3. 各詳細ページから PDF URL とメタ情報を抽出
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでは号別 PDF ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  TOP_URL,
  detectMeetingType,
  fetchPage,
  parseDirYear,
  toHankaku,
  parseDateFromPdfFilename,
  delay,
} from "./shared";

/** list フェーズが返す1件分のデータ */
export interface KanraSessionInfo {
  /** 会議タイトル（例: "第４回定例会（令和６年１２月） 第１号" ） */
  title: string;
  /** 開催日 YYYY-MM-DD（PDF 名から取得できない場合は null） */
  heldOn: string | null;
  /** 号別 PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 詳細ページの絶対 URL */
  detailPageUrl: string;
  /** 詳細ページ内での識別子（連番） */
  sessionIndex: number;
}

const INTER_PAGE_DELAY_MS = 1_500;

// --- HTML パーサー（テスト用に export） ---

export interface YearDirLink {
  /** ディレクトリ名 (例: "R6", "h31") */
  dir: string;
  /** 対応する西暦年 */
  year: number;
  /** 年度ページの絶対 URL */
  url: string;
}

/**
 * トップページ HTML から年度ディレクトリリンクを抽出する。
 */
export function parseYearDirLinks(html: string): YearDirLink[] {
  const links: YearDirLink[] = [];

  // href="./R6/index.html" や href="./h31/index.html" を抽出
  const pattern = /href=["']\.\/(R\d+|h\d+)\/index\.html["']/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const dir = m[1]!;
    const year = parseDirYear(dir);
    if (year === null) continue;

    const url = `${BASE_ORIGIN}/gikai/kaigiroku/${dir}/index.html`;

    // 重複除去
    if (!links.some((l) => l.dir === dir)) {
      links.push({ dir, year, url });
    }
  }

  return links;
}

export interface MeetingLink {
  /** リンクテキスト（例: "第４回定例会（令和６年１２月）"） */
  text: string;
  /** 詳細ページの絶対 URL */
  url: string;
}

/**
 * 年度ページ HTML から会議詳細ページのリンクを抽出する。
 */
export function parseMeetingLinks(html: string, baseUrl: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  // href に gikai-jimu/gikai/kaigi/ を含むリンクを抽出（相対・絶対パス両対応）
  const pattern =
    /href=["']([^"']+gikai-jimu\/gikai\/kaigi\/[^"']+\.html)["'][^>]*>([^<]+)</gi;

  const base = new URL(baseUrl);

  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const text = match[2]!.replace(/\s+/g, " ").trim();

    // 相対・絶対パスを統一して絶対 URL に変換
    const url = new URL(href, base).href;

    if (!seen.has(url)) {
      seen.add(url);
      links.push({ text, url });
    }
  }

  return links;
}

export interface PdfLink {
  /** リンクテキスト（例: "第１号（１２月６日）（377 KB）"） */
  text: string;
  /** PDF の絶対 URL */
  url: string;
}

/**
 * 詳細ページ HTML から PDF リンクを抽出する。
 * 目次は除外し、号別 PDF のみ返す。
 */
export function parsePdfLinks(html: string, detailPageUrl: string): PdfLink[] {
  const links: PdfLink[] = [];
  const seen = new Set<string>();

  const pattern = /href=["']([^"']+\.pdf)["'][^>]*>([^<]+)</gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const text = match[2]!.replace(/\s+/g, " ").trim();

    // 目次をスキップ
    if (text.includes("目次")) continue;

    // 絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス
      const base = new URL(detailPageUrl);
      url = new URL(href, base).href;
    }

    if (!seen.has(url)) {
      seen.add(url);
      links.push({ text, url });
    }
  }

  return links;
}

/**
 * 号別 PDF リンクテキストから号番号を取得する。
 * 例: "第１号（１２月６日）（377 KB）" → "第1号"
 */
export function parseSessionLabel(text: string): string {
  const normalized = toHankaku(text);
  const m = normalized.match(/第(\d+)号/);
  return m ? `第${m[1]}号` : text.split("（")[0]!.trim();
}

/**
 * 詳細ページ HTML と URL から号別セッション情報を組み立てる。
 */
export function extractSessionRecords(
  html: string,
  detailPageUrl: string,
  meetingTitle: string,
): KanraSessionInfo[] {
  const pdfLinks = parsePdfLinks(html, detailPageUrl);
  if (pdfLinks.length === 0) return [];

  const meetingType = detectMeetingType(meetingTitle);
  const records: KanraSessionInfo[] = [];

  for (let i = 0; i < pdfLinks.length; i++) {
    const pdf = pdfLinks[i]!;

    // PDF ファイル名から日付を取得
    const filename = pdf.url.split("/").pop() ?? "";
    const heldOn = parseDateFromPdfFilename(filename);

    const sessionLabel = parseSessionLabel(pdf.text);
    const title = `${meetingTitle} ${sessionLabel}`;

    records.push({
      title,
      heldOn,
      pdfUrl: pdf.url,
      meetingType,
      detailPageUrl,
      sessionIndex: i,
    });
  }

  return records;
}

/**
 * 指定年の全セッションを収集する。
 * 年度ページが存在しない場合は空配列を返す。
 */
export async function fetchSessionList(
  year: number,
): Promise<KanraSessionInfo[]> {
  // トップページから年度一覧を取得
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  const yearLinks = parseYearDirLinks(topHtml);
  const targetLink = yearLinks.find((l) => l.year === year);
  if (!targetLink) return [];

  await delay(INTER_PAGE_DELAY_MS);

  // 年度ページから会議リンクを取得
  const yearHtml = await fetchPage(targetLink.url);
  if (!yearHtml) return [];

  const meetingLinks = parseMeetingLinks(yearHtml, targetLink.url);

  const allSessions: KanraSessionInfo[] = [];

  for (const link of meetingLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const detailHtml = await fetchPage(link.url);
    if (!detailHtml) continue;

    const sessions = extractSessionRecords(detailHtml, link.url, link.text);
    allSessions.push(...sessions);
  }

  return allSessions;
}

/**
 * 西暦年からディレクトリ名を生成する。
 * 2024 → "R6", 2019 → "h31", 2010 → "h22"
 */
export function yearToDir(year: number): string | null {
  if (year >= 2020) {
    return `R${year - 2018}`;
  }
  if (year >= 2010) {
    return `h${year - 1988}`;
  }
  return null;
}
