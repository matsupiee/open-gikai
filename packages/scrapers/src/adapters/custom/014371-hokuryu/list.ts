/**
 * 北竜町議会 — list フェーズ
 *
 * トップページ + 年度別ページから全 PDF リンクを収集し、
 * リンクテキストから会議情報をパースする。
 *
 * URL 構造:
 *   - 最新年度（令和7年）: /tyousei/gikai/gikaikaigiroku/
 *   - 過去年度: /gikaikaigiroku_r{N}
 *
 * HTML 構造:
 *   entry-content 内の <strong>■定例会</strong> または <strong>■臨時会</strong> の
 *   直後にある <a href="...pdf"> リンクを取得する。
 */

import {
  BASE_ORIGIN,
  TOP_URL,
  detectMeetingType,
  fetchPage,
  resolveHref,
  convertWarekiDateToISO,
  toHalfWidth,
} from "./shared";

export interface HokuryuPdfLink {
  /** 会議タイトル（例: "第1回定例会（1日目）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * リンクテキストと現在の会議種別から会議情報をパースする。
 *
 * パターン:
 *   第{回数}回［{和暦}年{月}月{日}日］（{日目}日目）  ← 定例会（複数日）
 *   第{回数}回［{和暦}年{月}月{日}日］                ← 臨時会等（1日）
 */
export function parseLinkText(
  text: string,
  meetingKind: string
): {
  title: string;
  heldOn: string | null;
  meetingType: string;
} | null {
  const normalized = toHalfWidth(text.trim());

  // 第N回［...年M月D日］（X日目）のパターン
  const match = normalized.match(
    /第(\d+)回[［\[](.+?)(\d+)年(\d+)月(\d+)日[］\]](?:[（(](\d+)日目[）)])?/
  );
  if (!match) return null;

  const sessionNum = match[1]!;
  const eraPrefix = match[2]!.trim(); // 例: "令和" "平成"
  const eraYear = parseInt(match[3]!, 10);
  const month = parseInt(match[4]!, 10);
  const day = parseInt(match[5]!, 10);
  const dayNum = match[6]; // undefined の場合は1日目相当

  // 西暦に変換
  let westernYear: number;
  if (eraPrefix.includes("令和")) {
    westernYear = 2018 + eraYear;
  } else if (eraPrefix.includes("平成")) {
    westernYear = 1988 + eraYear;
  } else {
    return null;
  }

  const heldOn = `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const meetingType = detectMeetingType(meetingKind);

  let title = `第${sessionNum}回${meetingKind}`;
  if (dayNum) {
    title += `（${dayNum}日目）`;
  }

  return { title, heldOn, meetingType };
}

/**
 * 年度別ページ HTML から PDF リンクをパースする。
 *
 * entry-content 内の <strong>■定例会</strong> / <strong>■臨時会</strong> を
 * セクションヘッダーとして使い、その後の <a href="...pdf"> リンクを収集する。
 */
export function parseListPage(html: string): HokuryuPdfLink[] {
  // entry-content 部分を抽出
  const contentMatch = html.match(
    /<[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );
  const content = contentMatch ? contentMatch[1]! : html;

  const results: HokuryuPdfLink[] = [];
  let currentMeetingKind = "定例会";

  // ■定例会 / ■臨時会 のセクションを順に処理
  // セクション区切り: <strong>■定例会</strong> または <strong>■臨時会</strong>
  const sectionPattern =
    /<strong[^>]*>■(定例会|臨時会)<\/strong>([\s\S]*?)(?=<strong[^>]*>■(?:定例会|臨時会)<\/strong>|$)/gi;

  for (const sectionMatch of content.matchAll(sectionPattern)) {
    currentMeetingKind = sectionMatch[1]!;
    const sectionHtml = sectionMatch[2]!;

    // セクション内の <a href="...pdf"> リンクを収集
    const linkPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const linkMatch of sectionHtml.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const linkText = linkMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const parsed = parseLinkText(linkText, currentMeetingKind);
      if (!parsed || !parsed.heldOn) continue;

      const pdfUrl = resolveHref(href);

      results.push({
        title: parsed.title,
        heldOn: parsed.heldOn,
        pdfUrl,
        meetingType: parsed.meetingType,
      });
    }
  }

  // セクション分けがない場合（フォールバック）: ■定例会/■臨時会 テキストで判定
  if (results.length === 0) {
    const lines = content.split(/<br\s*\/?>/i);
    for (const line of lines) {
      const cleanLine = line.replace(/<[^>]+>/g, "").trim();
      if (cleanLine.includes("■定例会")) {
        currentMeetingKind = "定例会";
        continue;
      }
      if (cleanLine.includes("■臨時会")) {
        currentMeetingKind = "臨時会";
        continue;
      }

      const linkPattern = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
      for (const linkMatch of line.matchAll(linkPattern)) {
        const href = linkMatch[1]!;
        const linkText = linkMatch[2]!
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        const parsed = parseLinkText(linkText, currentMeetingKind);
        if (!parsed || !parsed.heldOn) continue;

        results.push({
          title: parsed.title,
          heldOn: parsed.heldOn,
          pdfUrl: resolveHref(href),
          meetingType: parsed.meetingType,
        });
      }
    }
  }

  return results;
}

/**
 * トップページから過去年度ページの URL を収集する。
 *
 * `wp-block-cocoon-blocks-button-1` クラスを持つ div 内の a タグから href を取得。
 */
export function parseYearPageUrls(html: string): string[] {
  const urls: string[] = [];

  const buttonPattern =
    /<div[^>]+class="[^"]*wp-block-cocoon-blocks-button-1[^"]*"[^>]*>[\s\S]*?<a\s[^>]*href="([^"]+)"[^>]*>/gi;

  for (const match of html.matchAll(buttonPattern)) {
    const href = match[1]!;
    if (!href.includes("gikaikaigiroku")) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
    urls.push(url);
  }

  return urls;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * 全年度ページを取得し、heldOn の年でフィルタリングして返す。
 * year は西暦（例: 2024）。
 */
export async function fetchDocumentList(
  year: number
): Promise<HokuryuPdfLink[]> {
  // トップページを取得
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  // 過去年度ページの URL を収集
  const yearPageUrls = parseYearPageUrls(topHtml);

  // 全ページ（トップ + 過去年度）を対象にする
  const allPageUrls = [TOP_URL, ...yearPageUrls];
  const allLinks: HokuryuPdfLink[] = [];

  for (const pageUrl of allPageUrls) {
    const html =
      pageUrl === TOP_URL ? topHtml : await fetchPage(pageUrl);
    if (!html) continue;

    const links = parseListPage(html);
    allLinks.push(...links);
  }

  // 指定年のデータのみ返す（暦年: 1月〜12月）
  return allLinks.filter((link) => {
    const heldYear = parseInt(link.heldOn.split("-")[0]!, 10);
    return heldYear === year;
  });
}

// convertWarekiDateToISO は shared から re-export（テスト用）
export { convertWarekiDateToISO };
