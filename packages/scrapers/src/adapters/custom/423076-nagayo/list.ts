/**
 * 長与町議会 -- list フェーズ
 *
 * 会議録一覧ページ (kiji{ID}/index.html) から全 PDF リンクを収集する。
 *
 * 構造:
 *   各ページは単一ページ（ページネーションなし）で、全年度のPDFが掲載されている。
 *
 *   <h2>令和6年</h2>
 *   <h3>第1回定例会</h3>
 *   <a href=".../3_1007_12345_R06_03_04.pdf">3月4日（第1号）</a>
 *   <a href=".../3_1007_30636_up_abc12345.pdf">6月10日（第2号）</a>
 *
 *   委員会ページは「第N日目」形式:
 *   <a href=".../3_1006_12345.pdf">3月15日（第1日目）</a>
 *
 * 開催日はリンクテキストの月日と年見出しから構築する。
 */

import {
  BASE_ORIGIN,
  convertWarekiToWesternYear,
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface NagayoPdfLink {
  /** 会議タイトル（例: "第1回定例会 3月4日（第1号）"） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 年の見出しから取得した西暦年 */
  headingYear: number;
  /** 開催日（YYYY-MM-DD） */
  heldOn: string;
  /** 会議カテゴリ（例: "本会議", "総務厚生常任委員会"） */
  meetingCategory: string;
}

/**
 * リンクテキストから月日情報を抽出する。
 *
 * 本会議: "3月4日（第1号）" → { month: 3, day: 4, label: "3月4日（第1号）" }
 * 委員会: "3月15日（第1日目）" → { month: 3, day: 15, label: "3月15日（第1日目）" }
 */
export function parseLinkText(text: string): {
  month: number;
  day: number;
  label: string;
} | null {
  const normalized = toHalfWidth(text.replace(/\s+/g, " ").trim());

  const match = normalized.match(/(\d+)月(\d+)日（第\d+(?:号|日目)）/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);

  return { month, day, label: normalized };
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * h2 タグから年度を取得し、h3 タグから定例会/臨時会の情報を取得する。
 * セクション内の a[href$=".pdf"] から PDF リンクを収集する。
 */
export function parseListPage(
  html: string,
  meetingCategory: string,
): NagayoPdfLink[] {
  const results: NagayoPdfLink[] = [];

  // h2 タグから年度見出しを収集
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const yearHeadings: { year: number; position: number }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = h2Pattern.exec(html)) !== null) {
    const innerText = hm[1]!.replace(/<[^>]+>/g, "").trim();
    const year = convertWarekiToWesternYear(innerText);
    if (year) {
      yearHeadings.push({ year, position: hm.index });
    }
  }

  if (yearHeadings.length === 0) return results;

  // 各年度セクション内で処理
  for (let i = 0; i < yearHeadings.length; i++) {
    const start = yearHeadings[i]!.position;
    const end =
      i + 1 < yearHeadings.length
        ? yearHeadings[i + 1]!.position
        : html.length;
    const section = html.slice(start, end);
    const currentYear = yearHeadings[i]!.year;

    // h3 タグから定例会/臨時会見出しを収集
    const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
    const sessionHeadings: { title: string; position: number }[] = [];
    let sh: RegExpExecArray | null;
    while ((sh = h3Pattern.exec(section)) !== null) {
      const title = sh[1]!.replace(/<[^>]+>/g, "").trim();
      if (title) {
        sessionHeadings.push({ title, position: sh.index });
      }
    }

    // PDF リンクを収集して直前の h3 見出しと紐付ける
    const linkPattern =
      /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let am: RegExpExecArray | null;
    while ((am = linkPattern.exec(section)) !== null) {
      const href = am[1]!;
      const linkText = am[2]!.replace(/<[^>]+>/g, "").trim();
      const linkPosition = am.index;

      if (!href.toLowerCase().endsWith(".pdf")) continue;

      const parsed = parseLinkText(linkText);
      if (!parsed) continue;

      // このリンクの直前の h3 見出しを探す
      let sessionTitle = "";
      for (const sh of sessionHeadings) {
        if (sh.position < linkPosition) {
          sessionTitle = sh.title;
        }
      }

      // 相対 URL を絶対 URL に変換
      let pdfUrl: string;
      if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        // kiji{ID}/index.html ページからの相対パスを解決
        pdfUrl = `${BASE_ORIGIN}/gikai/${href}`;
      }

      const heldOn = `${currentYear}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
      const title = sessionTitle
        ? `${sessionTitle} ${parsed.label}`
        : parsed.label;
      const meetingType = detectMeetingType(sessionTitle || title);

      results.push({
        title,
        pdfUrl,
        meetingType,
        headingYear: currentYear,
        heldOn,
        meetingCategory,
      });
    }
  }

  return results;
}

/** 取得対象ページ一覧 */
const MEETING_PAGES = [
  {
    meetingCategory: "本会議",
    path: "/gikai/kiji0031007/index.html",
  },
  {
    meetingCategory: "総務厚生常任委員会",
    path: "/gikai/kiji0032948/index.html",
  },
  {
    meetingCategory: "産業文教常任委員会",
    path: "/gikai/kiji0032949/index.html",
  },
  {
    meetingCategory: "議会広報広聴常任委員会",
    path: "/gikai/kiji0031008/index.html",
  },
  {
    meetingCategory: "議会運営委員会",
    path: "/gikai/kiji0031006/index.html",
  },
] as const;

/**
 * 指定年の PDF リンクを全会議種別から収集する。
 *
 * 5つの一覧ページから全 PDF リンクをパースし、
 * 対象年のものだけをフィルタリングして返す。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number,
): Promise<NagayoPdfLink[]> {
  const allLinks: NagayoPdfLink[] = [];

  for (const page of MEETING_PAGES) {
    const url = `${BASE_ORIGIN}${page.path}`;
    const html = await fetchPage(url);
    if (!html) continue;

    const links = parseListPage(html, page.meetingCategory);
    allLinks.push(...links);
  }

  return allLinks.filter((link) => link.headingYear === year);
}
