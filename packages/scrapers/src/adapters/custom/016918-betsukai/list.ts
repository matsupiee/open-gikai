/**
 * 別海町議会 -- list フェーズ
 *
 * 年度ページから PDF リンクとメタ情報を収集する。
 *
 * ページ構造:
 *   <h2>定例会</h2>
 *   <h3>令和7年第4回定例会（令和7年12月8日から12月12日）</h3>
 *   <ul>
 *     <li><a href="/resources/.../R7.4kaigiroku1.pdf">令和7年第4回定例会1日目会議録第1号（12月8日）</a>(PDF形式：440KB)</li>
 *   </ul>
 *   <h2>臨時会</h2>
 *   <h3>令和7年第4回臨時会（令和7年11月10日）</h3>
 *   ...
 */

import {
  BASE_ORIGIN,
  buildYearPageUrl,
  fetchPage,
} from "./shared";

export interface BetsukaiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/** 和暦（令和/平成）の元号と年数から西暦を返す */
function eraToWesternYear(era: string, eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  return era === "令和" ? eraYear + 2018 : eraYear + 1988;
}

/**
 * h3 見出しテキストから会議情報を抽出する。
 */
export function parseHeadingDate(heading: string): {
  westernYear: number;
  sessionLabel: string;
} | null {
  // パターン1: 「令和X年第Y回定例会」— 年度が先頭にある
  const match1 = heading.match(
    /(令和|平成)(元|\d+)年第(\d+)回(定例会|臨時会)/
  );
  if (match1) {
    const era = match1[1]!;
    const eraYearStr = match1[2]!;
    const sessionNum = match1[3]!;
    const sessionType = match1[4]!;

    const westernYear = eraToWesternYear(era, eraYearStr);

    const sessionLabel = `第${sessionNum}回${sessionType}`;
    return { westernYear, sessionLabel };
  }

  // パターン2: 「第Y回定例会（平成X年...）」— 年度がカッコ内にある（h22 等）
  const match2 = heading.match(
    /第(\d+)回(定例会|臨時会)[（(](令和|平成)(元|\d+)年/
  );
  if (match2) {
    const sessionNum = match2[1]!;
    const sessionType = match2[2]!;
    const era = match2[3]!;
    const eraYearStr = match2[4]!;

    const westernYear = eraToWesternYear(era, eraYearStr);

    const sessionLabel = `第${sessionNum}回${sessionType}`;
    return { westernYear, sessionLabel };
  }

  return null;
}

/**
 * リンクテキストから月日を抽出して YYYY-MM-DD を返す。
 *
 * パターン:
 *   - "令和7年第4回定例会1日目会議録第1号（12月8日）" → 12月8日
 *   - "第1回定例会（1日目）平成22年3月10日" → 平成22年3月10日
 *   - "令和6年第3回臨時会　別海町議会会議録第1号" → null (h3 の日付を使う)
 */
export function extractDateFromLinkText(
  linkText: string,
  fallbackYear: number
): string | null {
  // パターン1: 全角カッコ内の「X月X日」(「X日目」パターンを除外)
  const shortMatch = linkText.match(/[（(](\d{1,2})月(\d{1,2})日[）)]/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1]!, 10);
    const day = parseInt(shortMatch[2]!, 10);
    return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // パターン2: 「(令和|平成)X年X月X日」が直接含まれる
  const fullMatch = linkText.match(
    /(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/
  );
  if (fullMatch) {
    const year = eraToWesternYear(fullMatch[1]!, fullMatch[2]!);
    const month = parseInt(fullMatch[3]!, 10);
    const day = parseInt(fullMatch[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * h3 見出しから臨時会の開催日を抽出する。
 * 例: "令和7年第4回臨時会（令和7年11月10日）" → "2025-11-10"
 */
export function extractDateFromHeading(heading: string): string | null {
  // カッコ内の最初の「X年X月X日」を抽出（期間表記の場合は開始日を取得）
  const match = heading.match(
    /[（(](令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/
  );
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * HTML を正規表現で走査し、h2/h3/a タグの出現順を追跡して
 * セクション（定例会/臨時会）と会議情報を紐付ける。
 */
export function parseYearPage(html: string): BetsukaiMeeting[] {
  const results: BetsukaiMeeting[] = [];

  // h2, h3, PDF リンクの位置を収集
  interface TagMatch {
    type: "h2" | "h3" | "pdf";
    index: number;
    text: string;
    href?: string;
  }

  const tags: TagMatch[] = [];

  // h2 タグ
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  for (const m of html.matchAll(h2Pattern)) {
    tags.push({
      type: "h2",
      index: m.index!,
      text: m[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // h3 タグ
  const h3Pattern = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const m of html.matchAll(h3Pattern)) {
    tags.push({
      type: "h3",
      index: m.index!,
      text: m[1]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // PDF リンク
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(linkPattern)) {
    tags.push({
      type: "pdf",
      index: m.index!,
      href: m[1]!,
      text: m[2]!.replace(/<[^>]+>/g, "").trim(),
    });
  }

  // 出現順にソート
  tags.sort((a, b) => a.index - b.index);

  // 走査
  let currentSection = "";
  let currentHeadingInfo: {
    westernYear: number;
    sessionLabel: string;
    headingText: string;
  } | null = null;

  for (const tag of tags) {
    if (tag.type === "h2") {
      if (tag.text.includes("定例会") || tag.text.includes("臨時会")) {
        currentSection = tag.text;
      }
    } else if (tag.type === "h3") {
      const parsed = parseHeadingDate(tag.text);
      if (parsed) {
        currentHeadingInfo = {
          westernYear: parsed.westernYear,
          sessionLabel: parsed.sessionLabel,
          headingText: tag.text,
        };
      }
    } else {
      // PDF link
      const href = tag.href!;
      const linkText = tag.text;
      if (!currentHeadingInfo) continue;

      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

      // 日付を抽出
      let heldOn = extractDateFromLinkText(
        linkText,
        currentHeadingInfo.westernYear
      );

      // リンクテキストから日付が取れない場合は h3 見出しから取得
      if (!heldOn) {
        heldOn = extractDateFromHeading(currentHeadingInfo.headingText);
      }

      if (!heldOn) continue;

      // タイトルを構築
      const cleanTitle = linkText
        .replace(/\(PDF[^)]*\)/g, "")
        .replace(/（PDF[^）]*）/g, "")
        .trim();

      const sectionType = currentSection.includes("臨時")
        ? "臨時会"
        : "定例会";

      results.push({
        pdfUrl,
        title: cleanTitle || currentHeadingInfo.sessionLabel,
        heldOn,
        section: sectionType,
      });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<BetsukaiMeeting[]> {
  const yearPageUrl = buildYearPageUrl(baseUrl, year);
  if (!yearPageUrl) return [];

  const html = await fetchPage(yearPageUrl);
  if (!html) return [];

  return parseYearPage(html);
}
