/**
 * 水巻町議会 — list フェーズ
 *
 * 1. トップページ (030/010/) からリンクを収集し、年度コードを取得
 * 2. 各年度インデックス ({年度コード}/index.html) から会議詳細ページリンクを収集
 * 3. 各会議詳細ページから gijiroku.pdf リンクを抽出
 *
 * fetchDetail は MeetingData | null を1件返すため、
 * list フェーズでセッション日ごとに1レコードを返す。
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  fetchPage,
  delay,
  NENDO_CODE_MAP,
} from "./shared";

export interface MizumakiSessionInfo {
  /** 会議タイトル（例: "第1回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（詳細ページから取得、失敗時は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
  /** 詳細ページの一意ID（年度コード + 会議番号 + タイムスタンプ） */
  pageId: string;
  /** 年度（西暦） */
  nendoYear: number;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年度の全セッション日を収集する。
 * トップページから年度インデックス → 各会議詳細ページ → PDF リンクを辿る。
 */
export async function fetchSessionList(
  baseUrl: string,
  year: number
): Promise<MizumakiSessionInfo[]> {
  // Step 1: トップページから年度コードを収集
  const topUrl = baseUrl.replace(/\/$/, "") + "/";
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const nendoCodes = parseNendoCodes(topHtml);

  // 対象年度に対応する年度コードを絞り込む
  const targetCodes = nendoCodes.filter((code) => NENDO_CODE_MAP[code] === year);
  if (targetCodes.length === 0) return [];

  const allSessions: MizumakiSessionInfo[] = [];

  for (const nendoCode of targetCodes) {
    await delay(INTER_PAGE_DELAY_MS);

    // Step 2: 年度インデックスから会議詳細ページリンクを収集
    const indexUrl = `${BASE_ORIGIN}/li/gyosei/030/010/${nendoCode}/index.html`;
    const indexHtml = await fetchPage(indexUrl);
    if (!indexHtml) continue;

    const meetingLinks = parseMeetingLinks(indexHtml, nendoCode);

    for (const link of meetingLinks) {
      await delay(INTER_PAGE_DELAY_MS);

      // Step 3: 各会議詳細ページから gijiroku.pdf リンクを抽出
      const detailHtml = await fetchPage(link.url);
      if (!detailHtml) continue;

      const sessions = extractGijirokuRecords(detailHtml, link, year, link.url);
      allSessions.push(...sessions);
    }
  }

  return allSessions;
}

// --- HTML パーサー（テスト用に export） ---

/**
 * トップページ HTML から年度コードを抽出する。
 * リンク形式（相対パス）: href="./{年度コード}/index.html"
 * リンク形式（絶対パス）: href="/li/gyosei/030/010/{年度コード}/index.html"
 */
export function parseNendoCodes(html: string): string[] {
  const codes: string[] = [];
  const seen = new Set<string>();

  // 相対パスと絶対パスの両方に対応
  const pattern = /href="(?:\.\/|\/li\/gyosei\/030\/010\/)(\d{3})\/index\.html"/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const code = m[1]!;
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }

  return codes;
}

export interface MeetingLink {
  title: string;
  url: string;
  /** 年度コード_会議番号_タイムスタンプ */
  pageId: string;
  nendoCode: string;
  meetingNo: string;
}

/**
 * 年度インデックスページ HTML から会議詳細ページリンクを抽出する。
 *
 * リンク形式（絶対パス、会議番号あり）:
 *   href="/s043/gyosei/040/100/{年度コード}/{会議番号}/{タイムスタンプ}.html"
 * リンク形式（絶対パス、会議番号なし）:
 *   href="/s043/gyosei/040/100/{年度コード}/{タイムスタンプ}.html"
 * リンク形式（相対パス、任意の深さ）:
 *   href="../../../../../s043/gyosei/040/100/{年度コード}/..."
 */
export function parseMeetingLinks(html: string, nendoCode: string): MeetingLink[] {
  const links: MeetingLink[] = [];
  const seen = new Set<string>();

  // 絶対パスと相対パスの両方に対応
  // パターン: s043/gyosei/040/100/{nendoCode}/{会議番号?}/{タイムスタンプ}.html
  const pattern =
    /href="(?:\.\.\/)*(?:[^"]*\/)?(s043\/gyosei\/040\/100\/(\d+)\/(?:(\d{3})\/)?(\d{14})\.html)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const relPath = m[1]!;
    const urlNendoCode = m[2]!;
    const meetingNo = m[3] ?? "000"; // 会議番号がない場合は "000" とする
    const timestamp = m[4]!;
    const title = m[5]!.replace(/\s+/g, " ").trim();

    // 対象年度コードのリンクのみ取得
    if (urlNendoCode !== nendoCode) continue;

    const pageId = `${nendoCode}_${meetingNo}_${timestamp}`;
    if (seen.has(pageId)) continue;
    seen.add(pageId);

    links.push({
      title,
      url: `${BASE_ORIGIN}/${relPath}`,
      pageId,
      nendoCode,
      meetingNo,
    });
  }

  return links;
}

/**
 * 会議詳細ページ HTML から gijiroku.pdf リンクを抽出する。
 *
 * 各継続会（開催日）ごとにディレクトリが異なり、日付とペアで提供される。
 * gijiroku.pdf のみを対象とする（nittei.pdf は除外）。
 */
/**
 * pageId のタイムスタンプ部分から開催月を取得する。
 * pageId 形式: "{nendoCode}_{meetingNo}_{timestamp}"
 * timestamp 形式: "YYYYMMDDHHMMSS"
 */
function openingMonthFromPageId(pageId: string): number | null {
  const parts = pageId.split("_");
  const timestamp = parts[2];
  if (!timestamp || timestamp.length < 8) return null;
  const month = parseInt(timestamp.slice(4, 6), 10);
  return isNaN(month) ? null : month;
}

/**
 * 会議詳細ページ HTML から gijiroku.pdf リンクを抽出する。
 *
 * 実際のページ構造:
 *   <h2>6月3日（提案）</h2>
 *   <li><a href="./R6.6.3gijinittei.pdf">議事日程</a></li>
 *   <li><a href="./R6.6.3gijiroku.pdf">会議録</a></li>
 *
 * ファイル名に「gijiroku」を含む PDF のみを対象とする。
 * リンクテキストや href のファイル名に含まれる月日を日付として使用する。
 */
export function extractGijirokuRecords(
  html: string,
  link: MeetingLink,
  nendoYear: number,
  pageUrl?: string
): MizumakiSessionInfo[] {
  const records: MizumakiSessionInfo[] = [];
  const meetingType = detectMeetingType(link.title);
  const baseUrl = pageUrl ?? link.url;

  // gijiroku または kaigiroku を含む PDF リンクを抽出
  // リンク形式: href="./R6.6.3gijiroku.pdf" や href="./R3.3.1kaigiroku.pdf"
  const pdfPattern = /href="([^"]+(?:gijiroku|kaigiroku)[^"]*\.pdf)"/gi;

  // 日付を見出し（h2）とファイル名の両方から取得
  // ファイル名から日付を取得: R{年}.{月}.{日}gijiroku.pdf や R{年}.{月}.{日}kaigiroku.pdf → 月.日
  const filenamePattern = /[Rr]?\d*\.?(\d{1,2})\.(\d{1,2})(?:gijiroku|kaigiroku)/i;

  const seen = new Set<string>();
  let pm: RegExpExecArray | null;

  while ((pm = pdfPattern.exec(html)) !== null) {
    const href = pm[1]!;
    if (seen.has(href)) continue;
    seen.add(href);

    // 相対URLを絶対URLに変換
    let pdfUrl: string;
    try {
      pdfUrl = new URL(href, baseUrl).toString();
    } catch {
      pdfUrl = `${BASE_ORIGIN}/${href.replace(/^\.\//, "")}`;
    }

    // ファイル名から日付を抽出
    const filenameMatch = href.match(filenamePattern);
    let heldOn: string | null = null;

    if (filenameMatch) {
      const month = parseInt(filenameMatch[1]!, 10);
      const day = parseInt(filenameMatch[2]!, 10);

      // 開催月が10-12月で継続会が1-3月の場合は翌年扱い
      const openingMonth = openingMonthFromPageId(link.pageId);
      const heldOnYear =
        openingMonth !== null && openingMonth >= 10 && month <= 3
          ? nendoYear + 1
          : nendoYear;

      heldOn = `${heldOnYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // 見出し（h2）から日付を取得するフォールバック
    if (!heldOn) {
      // href の前にある最後の h2 タグから日付を抽出
      const beforeHref = html.slice(0, pm.index);
      const h2Matches = [...beforeHref.matchAll(/<h2[^>]*>(\d{1,2})月(\d{1,2})日/gi)];
      if (h2Matches.length > 0) {
        const lastH2 = h2Matches[h2Matches.length - 1]!;
        const month = parseInt(lastH2[1]!, 10);
        const day = parseInt(lastH2[2]!, 10);

        const openingMonth = openingMonthFromPageId(link.pageId);
        const heldOnYear =
          openingMonth !== null && openingMonth >= 10 && month <= 3
            ? nendoYear + 1
            : nendoYear;

        heldOn = `${heldOnYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    const pdfFileName = href.split("/").pop() ?? href;
    records.push({
      title: link.title,
      heldOn,
      pdfUrl,
      meetingType,
      pageId: `${link.pageId}_${pdfFileName}`,
      nendoYear,
    });
  }

  return records;
}
