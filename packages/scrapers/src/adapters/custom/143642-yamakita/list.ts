/**
 * 山北町議会 会議録 — list フェーズ
 *
 * 一覧ページ (category/14-3-0-0-0.html) から全会議録ページへのリンクを収集し、
 * 各詳細ページから会議録 PDF のリンクを取得する。
 *
 * 構造:
 *   一覧ページ
 *   └── <a href="/{pageId}.html">令和X年第Y回定例会会議録</a>
 *
 *   詳細ページ
 *   ├── h2（本会議/一般質問/委員会）
 *   │   └── h3（日付）
 *   │       └── div.mol_attachfileblock > ul > li > a (PDF リンク)
 *   └── ...
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  buildDetailUrl,
  buildExternalId,
  fetchPage,
  parseJapaneseDate,
  extractYearFromTitle,
} from "./shared";

export interface YamakitaListEntry {
  /** ページ ID (e.g., "0000006954") */
  pageId: string;
  /** 会議タイトル (e.g., "令和7年第3回定例会会議録") */
  title: string;
}

export interface YamakitaMeeting {
  /** ページ ID */
  pageId: string;
  /** 会議タイトル */
  title: string;
  /** 会議録 PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 詳細ページ URL */
  detailUrl: string;
  /** externalId */
  externalId: string;
}

/**
 * 一覧ページ HTML から会議録ページへのリンクを抽出する。
 */
export function parseListPage(html: string): YamakitaListEntry[] {
  const results: YamakitaListEntry[] = [];

  // /{pageId}.html 形式のリンクを抽出（pageId は数字のみ）
  // タイトルに「会議録」を含むものを対象とする
  const linkRegex =
    /<a[^>]+href="[^"]*\/(\d{10})\.html"[^>]*>([^<]*(?:定例会|臨時会)[^<]*会議録[^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const pageId = match[1];
    const title = match[2]?.trim();
    if (!pageId || !title) continue;

    // 重複チェック
    if (results.some((r) => r.pageId === pageId)) continue;

    results.push({ pageId, title });
  }

  return results;
}

/**
 * 詳細ページの HTML から会議録 PDF リンクと開催日を抽出する。
 *
 * 会議録 PDF の判定:
 * - リンクテキストに「【会議録】」が含まれる
 * - または href に "kaigiroku" が含まれる
 * - または href に "minutes" が含まれる
 * - または h2 が「一般質問」または「委員会」でリンクがある
 */
export function parseDetailPage(
  html: string,
  _pageId: string
): { pdfUrl: string; heldOn: string | null }[] {
  const results: { pdfUrl: string; heldOn: string | null }[] = [];

  // mol_attachfileblock 内の PDF リンクを抽出する
  // h3 タグから日付を取得し、対応する PDF リンクと組み合わせる

  // 簡易パーサー: h2/h3 ブロックごとに処理する
  // まず h3 タグとその後続の mol_attachfileblock を対応付ける

  // h3 の日付テキストを収集
  const h3DateMap = new Map<number, string | null>();
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const h3Match of html.matchAll(h3Regex)) {
    const h3Text = h3Match[0].replace(/<[^>]+>/g, "").trim();
    const heldOn = parseJapaneseDate(h3Text);
    h3DateMap.set(h3Match.index!, heldOn);
  }

  // PDF リンクを全て取得して、各リンクの前にある最も近い h3 の日付を対応させる
  const pdfLinkRegex =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const pdfMatch of html.matchAll(pdfLinkRegex)) {
    const href = pdfMatch[1]!;
    const linkText = pdfMatch[2]!.replace(/<[^>]+>/g, "").trim();
    const pdfMatchIndex = pdfMatch.index!;

    // 会議録 PDF かどうか判定（表紙・議事日程を除外）
    if (
      !isMinutesPdf(linkText, href)
    ) {
      continue;
    }

    // 絶対 URL に変換
    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/cmsfiles/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パスの場合はページIDから構築
      pdfUrl = `${BASE_ORIGIN}${href}`;
    }

    // このリンクの前にある最も近い h3 の日付を探す
    let closestHeldOn: string | null = null;
    let closestDistance = Infinity;
    for (const [h3Index, heldOn] of h3DateMap) {
      if (h3Index < pdfMatchIndex) {
        const distance = pdfMatchIndex - h3Index;
        if (distance < closestDistance) {
          closestDistance = distance;
          closestHeldOn = heldOn;
        }
      }
    }

    results.push({ pdfUrl, heldOn: closestHeldOn });
  }

  return results;
}

/**
 * 会議録 PDF かどうかを判定する。
 * 表紙・議事日程は除外し、会議録本文・一般質問・委員会を対象とする。
 */
export function isMinutesPdf(linkText: string, href: string): boolean {
  // 除外: 表紙・議事日程
  if (linkText.includes("【表紙】") || href.includes("frontcover") || href.includes("hyoushi")) {
    return false;
  }
  if (linkText.includes("【議事日程】") || href.includes("agenda") || href.includes("nittei")) {
    return false;
  }

  // 含める: 会議録・一般質問・委員会
  if (linkText.includes("【会議録】") || href.includes("minutes") || href.includes("kaigiroku")) {
    return true;
  }
  if (linkText.includes("一般質問")) {
    return true;
  }
  if (linkText.includes("委員会")) {
    return true;
  }

  // リンクテキストに番号付き議員名パターン（一般質問個別PDF）
  if (/^\d+\./.test(linkText)) {
    return true;
  }

  return false;
}

/**
 * 指定年度の全会議録一覧を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<YamakitaMeeting[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const allEntries = parseListPage(listHtml);

  // 指定年度でフィルタ（前年度から翌年にかけて開催されることがあるため年で判定）
  const filtered = allEntries.filter((entry) => {
    const entryYear = extractYearFromTitle(entry.title);
    return entryYear === year;
  });

  const meetings: YamakitaMeeting[] = [];

  for (const entry of filtered) {
    const detailUrl = buildDetailUrl(entry.pageId);
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const pdfLinks = parseDetailPage(detailHtml, entry.pageId);
    if (pdfLinks.length === 0) continue;

    for (const { pdfUrl, heldOn } of pdfLinks) {
      if (!heldOn) continue;

      meetings.push({
        pageId: entry.pageId,
        title: entry.title,
        pdfUrl,
        heldOn,
        detailUrl,
        externalId: buildExternalId(`${entry.pageId}_${encodeURIComponent(pdfUrl)}`),
      });
    }
  }

  return meetings;
}
