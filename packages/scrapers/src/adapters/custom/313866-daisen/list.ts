/**
 * 大山町議会 会議録 -- list フェーズ
 *
 * 3階層のナビゲーションでPDFリンクを収集する:
 *
 * 1. トップページ (/gikai/9/) → 年度別ページ URL を収集
 * 2. 年度別ページ (/gikai/9/{yearId}/) → 臨時会PDF直リンク + 定例会サブページリンクを収集
 * 3. 定例会サブページ (/gikai/9/{yearId}/{sessionId}/) → 日程別PDF直リンクを収集
 *
 * 旧形式（平成25年以前）は年度ページから直接日程別PDFリンクを取得する。
 */

import {
  BASE_ORIGIN,
  TOP_PATH,
  RINJI_PATTERN,
  TEIREI_PATTERN,
  DAY_PATTERN,
  OLD_TEIREI_PATTERN,
  buildDate,
  fetchPage,
  toAbsoluteUrl,
  warekiToSeireki,
} from "./shared";

export interface DaisenMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第2回定例会 第1日（2月26日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（plenary / extraordinary） */
  meetingType: string;
}

/**
 * トップページ HTML から年度別ページ URL を抽出する。
 * リンクテキストから和暦を西暦に変換する。
 */
export function parseTopPage(html: string): { year: number; url: string }[] {
  const results: { year: number; url: string }[] = [];

  // /gikai/9/{yearId}/ 形式のリンクを抽出
  const linkPattern =
    /<a\s[^>]*href="(\/gikai\/9\/[^"]+\/)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 「令和N年」「平成N年」を含むリンクのみ対象
    const year = warekiToSeireki(linkText);
    if (!year) continue;

    results.push({ year, url: toAbsoluteUrl(href) });
  }

  return results;
}

/**
 * 年度別ページ HTML からリンクを抽出する。
 *
 * 返り値:
 *   - pdfLinks: PDF への直接リンク（臨時会 + 旧形式定例会）
 *   - subPageLinks: 定例会サブページへのリンク
 */
export function parseYearPage(
  html: string,
  fiscalYear: number,
): {
  pdfMeetings: DaisenMeeting[];
  subPageLinks: { url: string; sessionNum: string; linkText: string }[];
} {
  const pdfMeetings: DaisenMeeting[] = [];
  const subPageLinks: { url: string; sessionNum: string; linkText: string }[] =
    [];

  // すべてのリンクを抽出
  const linkPattern = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // PDF 直リンク
    if (href.toLowerCase().endsWith(".pdf")) {
      // 臨時会パターン
      const rinjiMatch = linkText.match(RINJI_PATTERN);
      if (rinjiMatch) {
        const sessionNum = rinjiMatch[1]!;
        const month = parseInt(rinjiMatch[2]!, 10);
        const day = parseInt(rinjiMatch[3]!, 10);

        pdfMeetings.push({
          pdfUrl: toAbsoluteUrl(href),
          title: `第${sessionNum}回臨時会（${month}月${day}日）`,
          heldOn: buildDate(fiscalYear, month, day),
          meetingType: "extraordinary",
        });
        continue;
      }

      // 旧形式の定例会パターン（H25以前）
      const oldTeireiMatch = linkText.match(OLD_TEIREI_PATTERN);
      if (oldTeireiMatch) {
        const sessionNum = oldTeireiMatch[1]!;
        const dayNum = oldTeireiMatch[2]!;
        const month = parseInt(oldTeireiMatch[3]!, 10);
        const day = parseInt(oldTeireiMatch[4]!, 10);

        pdfMeetings.push({
          pdfUrl: toAbsoluteUrl(href),
          title: `第${sessionNum}回定例会 第${dayNum}日（${month}月${day}日）`,
          heldOn: buildDate(fiscalYear, month, day),
          meetingType: "plenary",
        });
        continue;
      }
    }

    // 定例会サブページリンク
    const teireiMatch = linkText.match(TEIREI_PATTERN);
    if (teireiMatch && /\/gikai\/9\/[^/]+\/[^/]+\/$/.test(href)) {
      subPageLinks.push({
        url: toAbsoluteUrl(href),
        sessionNum: teireiMatch[1]!,
        linkText,
      });
    }
  }

  return { pdfMeetings, subPageLinks };
}

/**
 * 定例会サブページ HTML から日程別 PDF リンクを抽出する。
 */
export function parseSubPage(
  html: string,
  sessionNum: string,
  fiscalYear: number,
): DaisenMeeting[] {
  const meetings: DaisenMeeting[] = [];

  const linkPattern = /<a\s[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    const dayMatch = linkText.match(DAY_PATTERN);
    if (dayMatch) {
      const dayNum = dayMatch[1]!;
      const month = parseInt(dayMatch[2]!, 10);
      const day = parseInt(dayMatch[3]!, 10);

      meetings.push({
        pdfUrl: toAbsoluteUrl(href),
        title: `第${sessionNum}回定例会 第${dayNum}日（${month}月${day}日）`,
        heldOn: buildDate(fiscalYear, month, day),
        meetingType: "plenary",
      });
    }
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<DaisenMeeting[]> {
  // Step 1: トップページから年度別ページ URL を取得
  const topUrl = `${BASE_ORIGIN}${TOP_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);

  // 大山町は年度制。year が 2025 なら「令和7年」(2025年度 = 2025年4月〜2026年3月) を探す。
  // 会議録一覧ページのリンクテキストは「令和7年 会議録」で 2025 にマッチする。
  const targetPage = yearPages.find((p) => p.year === year);
  if (!targetPage) return [];

  // Step 2: 年度別ページから会議リンクを収集
  const yearHtml = await fetchPage(targetPage.url);
  if (!yearHtml) return [];

  const { pdfMeetings, subPageLinks } = parseYearPage(yearHtml, year);

  // Step 3: 定例会サブページを巡回して日程別 PDF を収集
  for (const sub of subPageLinks) {
    const subHtml = await fetchPage(sub.url);
    if (!subHtml) continue;

    const subMeetings = parseSubPage(subHtml, sub.sessionNum, year);
    pdfMeetings.push(...subMeetings);
  }

  return pdfMeetings;
}
