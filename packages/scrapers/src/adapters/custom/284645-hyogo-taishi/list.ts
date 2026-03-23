/**
 * 太子町議会（兵庫県） -- list フェーズ
 *
 * 1. インデックスページ（令和元年以降・平成28年以前）から年度別ページURLを収集
 * 2. 対象年度のページからPDFリンクを抽出
 *
 * 各PDFリンクが1レコードとなり、fetchDetail に渡される。
 * 目次PDF（mokujiを含むファイル名）はスキップする。
 */

import {
  INDEX_URL_RECENT,
  INDEX_URL_OLD,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface TaishiSessionInfo {
  /** 会議タイトル（例: "第511回太子町議会定例会（12月）会議録 第1日"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 会議名（見出しから取得） */
  sessionName: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全セッション日を収集する。
 * 両インデックスページから年度別ページURLを収集し、対象年度のページを処理する。
 */
export async function fetchSessionList(
  _baseUrl: string,
  year: number
): Promise<TaishiSessionInfo[]> {
  const allSessions: TaishiSessionInfo[] = [];

  // Step 1: 両インデックスから年度別URLを収集
  const yearPageLinks = await fetchAllYearPageLinks();

  // Step 2: 対象年度に絞り込み
  const targetLinks = yearPageLinks.filter((link) => {
    const seirekiYear = parseWarekiYear(link.title);
    return seirekiYear !== null && seirekiYear === year;
  });

  // Step 3: 各年度ページから PDF リンクを収集
  for (const link of targetLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const sessions = extractPdfRecords(pageHtml, link.url);
    allSessions.push(...sessions);
  }

  return allSessions;
}

export interface YearPageLink {
  title: string;
  url: string;
}

/**
 * 両インデックスページから年度別ページへのリンクを収集する。
 */
async function fetchAllYearPageLinks(): Promise<YearPageLink[]> {
  const allLinks: YearPageLink[] = [];

  for (const indexUrl of [INDEX_URL_RECENT, INDEX_URL_OLD]) {
    const html = await fetchPage(indexUrl);
    if (!html) continue;
    allLinks.push(...parseYearPageLinks(html));
    await delay(INTER_PAGE_DELAY_MS);
  }

  // 重複排除
  const seen = new Set<string>();
  return allLinks.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

/**
 * インデックスページ HTML から年度別ページリンクを抽出する。
 * 対象: soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/ 配下へのリンク
 */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  // 絶対URL形式: href="https://www.town.hyogo-taishi.lg.jp/.../XXXX.html"
  const pattern =
    /href="(https?:\/\/www\.town\.hyogo-taishi\.lg\.jp\/soshikikarasagasu\/taishityougikai\/honkaiginnokaigiroku\/[^"]+\.html)"[^>]*>([^<]+)</gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const url = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 年度一覧ページ自体（index.html）を除外
    if (url.endsWith("index.html")) continue;

    // 「本会議会議録」を含むリンクのみ対象
    if (!title.includes("会議録") && !title.includes("本会議")) continue;

    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ title, url });
  }

  return links;
}

/**
 * 年度別ページ HTML から PDF リンクを抽出し、セッション日情報を返す。
 *
 * ページ構造:
 *   <h2>第511回太子町議会定例会（12月）会議録</h2>
 *   <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-12mokuji_.pdf">目次 (PDFファイル: ...)</a>
 *   <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R6-11-29.pdf">第1日（令和6年11月29日） (PDFファイル: ...)</a>
 *
 * 目次PDF（mokujiを含む）はスキップする。
 */
export function extractPdfRecords(
  html: string,
  pageUrl: string
): TaishiSessionInfo[] {
  const records: TaishiSessionInfo[] = [];

  // h2 または h3 見出しと PDF リンクを順番に処理する
  // まず全てのトークン（見出し or PDF リンク）を位置順に抽出
  type Token =
    | { type: "heading"; text: string; pos: number }
    | { type: "link"; href: string; text: string; pos: number };

  const tokens: Token[] = [];

  // 見出し（h2/h3）を抽出
  const headingPattern = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingPattern.exec(html)) !== null) {
    const text = hm[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) {
      tokens.push({ type: "heading", text, pos: hm.index });
    }
  }

  // material/files/group/16/ を含む PDF リンクを抽出
  const linkPattern =
    /href="((?:https?:)?\/\/www\.town\.hyogo-taishi\.lg\.jp\/material\/files\/group\/16\/[^"]+\.pdf)"[^>]*>\s*([^<]+)\s*<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkPattern.exec(html)) !== null) {
    const href = lm[1]!;
    const text = lm[2]!.replace(/\s+/g, " ").trim();
    tokens.push({ type: "link", href, text, pos: lm.index });
  }

  // 位置順にソート
  tokens.sort((a, b) => a.pos - b.pos);

  // トークンを処理して現在の見出しを追跡
  let currentSessionName = "";
  let currentMeetingType = "plenary";

  for (const token of tokens) {
    if (token.type === "heading") {
      currentSessionName = token.text;
      currentMeetingType = detectMeetingType(token.text);
      continue;
    }

    // PDF リンクの処理
    const { href, text } = token;
    const filename = href.split("/").pop() ?? "";

    // 目次PDFをスキップ
    if (filename.toLowerCase().includes("mokuji")) continue;

    // 絶対URLに変換（// → https://）
    const absoluteUrl = href.startsWith("//")
      ? `https:${href}`
      : href.startsWith("http")
        ? href
        : new URL(href, pageUrl).toString();

    // リンクテキストから開催日を抽出
    // 形式: "第1日（令和6年11月29日）" または "（令和7年1月28日）"
    const dateMatch = text.match(/[（(](?:令和|平成)(\d+|元)年(\d{1,2})月(\d{1,2})日[）)]/);
    if (!dateMatch) continue;

    const eraYear = dateMatch[1] === "元" ? 1 : parseInt(dateMatch[1]!, 10);
    const month = parseInt(dateMatch[2]!, 10);
    const day = parseInt(dateMatch[3]!, 10);

    // 令和/平成を判定（テキスト中に含まれる文字で判定）
    const isReiwa = text.includes("令和");
    const isHeisei = text.includes("平成");
    let seirekiYear: number;
    if (isReiwa) {
      seirekiYear = 2018 + eraYear;
    } else if (isHeisei) {
      seirekiYear = 1988 + eraYear;
    } else {
      continue;
    }

    const heldOn = `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // タイトルを生成
    const cleanText = text.replace(/\s*\(PDFファイル:[^)]*\)\s*$/, "").trim();
    const title = currentSessionName
      ? `${currentSessionName} ${cleanText}`
      : cleanText;

    records.push({
      title,
      heldOn,
      pdfUrl: absoluteUrl,
      meetingType: currentMeetingType,
      sessionName: currentSessionName,
    });
  }

  return records;
}
