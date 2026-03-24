/**
 * 沼田町議会 — list フェーズ
 *
 * 議会トップページから年度別一覧ページの URL を収集し、
 * 各年度ページから PDF リンクとメタ情報を抽出する。
 *
 * URL 構造:
 *   - 議会トップ: /section/gikai/index.html
 *   - 年度別一覧: /section/gikai/{ページID}.html
 *   - PDF: /section/gikai/{ページID}-att/{ファイルID}.pdf
 *
 * HTML 構造:
 *   - <h4> で「定例会」「臨時会」を区分
 *   - <h5> で「第N回定例会」等の回次を区分
 *   - <ul> 内の <a> タグに PDF リンクとテキストが記載
 *   - リンクテキスト例: "第1回（1日目）（令和7年3月6日） (PDF xxxKB)"
 *   - リンクテキスト例: "第2回（令和6年6月18日） (PDF xxxKB)"
 */

import {
  BASE_ORIGIN,
  TOP_URL,
  detectMeetingType,
  fetchPage,
  convertWarekiDateToISO,
  toHalfWidth,
} from "./shared";

export interface NumataPdfLink {
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
 * 議会トップページから年度別一覧ページの URL を収集する。
 *
 * /section/gikai/ 配下のリンクのうち、index.html 以外のページリンクを抽出する。
 */
export function parseYearPageUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // /section/gikai/{ID}.html 形式のリンクを抽出（index.html は除外）
  const linkPattern =
    /href="(\/section\/gikai\/(?!index)[^"]+\.html)"/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const url = `${BASE_ORIGIN}${href}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

/**
 * リンクテキストから会議情報をパースする。
 *
 * パターン:
 *   第N回（M日目）（令和X年Y月Z日）
 *   第N回（令和X年Y月Z日）
 */
export function parseLinkText(
  text: string,
  meetingKind: string,
  sessionNum: string
): {
  title: string;
  heldOn: string | null;
  meetingType: string;
} | null {
  const normalized = toHalfWidth(text.trim());

  // 日付部分を抽出: （令和X年Y月Z日）または（平成X年Y月Z日）
  const dateMatch = normalized.match(
    /[（(]((?:令和|平成)(?:元|\d+)年\d+月\d+日)[）)]/
  );
  if (!dateMatch) return null;

  const heldOn = convertWarekiDateToISO(dateMatch[1]!);
  if (!heldOn) return null;

  // 日次を抽出
  const dayMatch = normalized.match(/[（(](\d+)日目[）)]/);
  const meetingType = detectMeetingType(meetingKind);

  let title = `第${sessionNum}回${meetingKind}`;
  if (dayMatch) {
    title += `（${dayMatch[1]}日目）`;
  }

  return { title, heldOn, meetingType };
}

/**
 * 年度別一覧ページ HTML から PDF リンクをパースする。
 *
 * <h4> で会議種別、<h5> で回次を判定し、<ul> 内の PDF リンクを収集する。
 */
export function parseListPage(html: string, baseUrl: string): NumataPdfLink[] {
  const results: NumataPdfLink[] = [];

  // ページ ID を URL から取得（att ディレクトリ構成のため）
  const pageIdMatch = baseUrl.match(/\/section\/gikai\/([^/]+)\.html/);
  const pageId = pageIdMatch ? pageIdMatch[1]! : "";

  let currentMeetingKind = "定例会";
  let currentSessionNum = "1";

  // HTML を行ベースで処理（h4 → h5 → ul/li/a の順でコンテキストを追跡）
  // タグ単位でトークン分割して処理
  const tagPattern = /<(h4|h5|a)[^>]*>([\s\S]*?)<\/\1>/gi;

  for (const tagMatch of html.matchAll(tagPattern)) {
    const tagName = tagMatch[1]!.toLowerCase();
    const innerText = tagMatch[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (tagName === "h4") {
      if (innerText.includes("臨時会")) {
        currentMeetingKind = "臨時会";
      } else if (innerText.includes("定例会")) {
        currentMeetingKind = "定例会";
      }
      continue;
    }

    if (tagName === "h5") {
      // 「第N回定例会」「第N回臨時会」等から回次を抽出
      const sessionMatch = innerText.match(/第(\d+)回/);
      if (sessionMatch) {
        currentSessionNum = sessionMatch[1]!;
      }
      // h5 のテキストから会議種別も更新
      if (innerText.includes("臨時会")) {
        currentMeetingKind = "臨時会";
      } else if (innerText.includes("定例会")) {
        currentMeetingKind = "定例会";
      }
      continue;
    }

    if (tagName === "a") {
      // PDF リンクを抽出
      const fullTag = tagMatch[0]!;
      const hrefMatch = fullTag.match(/href="([^"]+\.pdf)"/i);
      if (!hrefMatch) continue;

      const href = hrefMatch[1]!;
      // 絶対 URL に変換
      let pdfUrl: string;
      if (href.startsWith("http://") || href.startsWith("https://")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        // 相対パスの場合はページ ID の att ディレクトリ配下と想定
        pdfUrl = `${BASE_ORIGIN}/section/gikai/${pageId}-att/${href}`;
      }

      const parsed = parseLinkText(innerText, currentMeetingKind, currentSessionNum);
      if (!parsed || !parsed.heldOn) continue;

      results.push({
        title: parsed.title,
        heldOn: parsed.heldOn,
        pdfUrl,
        meetingType: parsed.meetingType,
      });
    }
  }

  return results;
}

/**
 * 指定年の PDF リンクを収集する。
 *
 * 議会トップページから年度別ページ URL を収集し、
 * 各年度ページから PDF リンクを抽出して heldOn の年でフィルタリングする。
 * year は西暦（例: 2024）。
 */
export async function fetchDocumentList(
  year: number
): Promise<NumataPdfLink[]> {
  // トップページを取得
  const topHtml = await fetchPage(TOP_URL);
  if (!topHtml) return [];

  // 年度別ページの URL を収集
  const yearPageUrls = parseYearPageUrls(topHtml);

  const allLinks: NumataPdfLink[] = [];

  for (const pageUrl of yearPageUrls) {
    const html = await fetchPage(pageUrl);
    if (!html) continue;

    const links = parseListPage(html, pageUrl);
    allLinks.push(...links);

    // レート制限対策
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 指定年のデータのみ返す（暦年: 1月〜12月）
  return allLinks.filter((link) => {
    const heldYear = parseInt(link.heldOn.split("-")[0]!, 10);
    return heldYear === year;
  });
}
