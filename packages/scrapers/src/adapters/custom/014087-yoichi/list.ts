/**
 * 余市町議会 — list フェーズ
 *
 * 会議録一覧ページ (https://www.town.yoichi.hokkaido.jp/gikai/kaigiroku/)
 * から全 PDF リンクを収集し、ファイル名・周辺テキストから会議情報をパースする。
 *
 * ファイル命名規則:
 *   新形式（令和5年以降）: R{年}.{回}tei{日程}.pdf / R{年}.{回}rin.pdf
 *   旧形式1（令和5年一部）: {回}tei.R{年}.{月}.{日}.pdf
 *   旧形式2（令和4年）: kaigiroku{回}tei{日程}R{年}.{月}.{日}.pdf
 */

import {
  BASE_ORIGIN,
  LIST_PATH,
  detectMeetingType,
  toHalfWidth,
  reiwaToWestern,
  fetchPage,
} from "./shared";

export interface YoichiPdfLink {
  /** 会議タイトル（例: "第3回定例会1日目"） */
  title: string;
  /** 開催日 YYYY-MM-DD。解析できない場合は null */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * ファイル名から会議情報を解析する。
 *
 * 新形式（令和5年以降）:
 *   R7.3tei1.pdf → 令和7年第3回定例会第1日目
 *   R6.5rin.pdf  → 令和6年第5回臨時会
 *
 * 旧形式1（令和5年一部）:
 *   4tei.R05.12.12.pdf → 令和5年第4回定例会 12月12日
 *
 * 旧形式2（令和4年）:
 *   kaigiroku4tei1R04.12.13.pdf → 令和4年第4回定例会第1日目 12月13日
 */
export function parseFilename(filename: string): {
  sessionNum: number;
  meetingKind: "定例会" | "臨時会";
  dayNum: number | null;
  year: number;
  month: number | null;
  day: number | null;
} | null {
  // 新形式: R{年}.{回}(tei|rin){日程?}.pdf
  const newFormat = /^R(\d+)\.(\d+)(tei|rin)(\d*)\.pdf$/i;
  let m = filename.match(newFormat);
  if (m) {
    const year = reiwaToWestern(m[1]!);
    const sessionNum = parseInt(m[2]!, 10);
    const kind = m[3]!.toLowerCase() === "tei" ? "定例会" : "臨時会";
    const dayNum = m[4] ? parseInt(m[4], 10) : null;
    return { sessionNum, meetingKind: kind, dayNum, year, month: null, day: null };
  }

  // 旧形式1: {回}tei.R{年}.{月}.{日}.pdf
  const oldFormat1 = /^(\d+)(tei|rin)\.R(\d+)\.(\d+)\.(\d+)\.pdf$/i;
  m = filename.match(oldFormat1);
  if (m) {
    const sessionNum = parseInt(m[1]!, 10);
    const kind = m[2]!.toLowerCase() === "tei" ? "定例会" : "臨時会";
    const year = reiwaToWestern(m[3]!);
    const month = parseInt(m[4]!, 10);
    const day = parseInt(m[5]!, 10);
    return { sessionNum, meetingKind: kind, dayNum: null, year, month, day };
  }

  // 旧形式2: kaigiroku{回}tei{日程?}R{年}.{月}.{日}.pdf
  const oldFormat2 = /^kaigiroku(\d+)(tei|rin)(\d*)R(\d+)\.(\d+)\.(\d+)\.pdf$/i;
  m = filename.match(oldFormat2);
  if (m) {
    const sessionNum = parseInt(m[1]!, 10);
    const kind = m[2]!.toLowerCase() === "tei" ? "定例会" : "臨時会";
    const dayNum = m[3] ? parseInt(m[3], 10) : null;
    const year = reiwaToWestern(m[4]!);
    const month = parseInt(m[5]!, 10);
    const day = parseInt(m[6]!, 10);
    return { sessionNum, meetingKind: kind, dayNum, year, month, day };
  }

  return null;
}

/**
 * ページの周辺テキストと a タグのコンテキストから
 * 年・月を補完するために 〇令和X年第Y回... の見出しパターンを解析する。
 */
export function parseMeetingHeading(text: string): {
  year: number;
  sessionNum: number;
  meetingKind: "定例会" | "臨時会";
} | null {
  const normalized = toHalfWidth(text);
  const m = normalized.match(/〇令和(元|\d+)年第(\d+)回(定例会|臨時会)/);
  if (!m) return null;
  const year = reiwaToWestern(m[1]!);
  const sessionNum = parseInt(m[2]!, 10);
  const meetingKind = m[3] as "定例会" | "臨時会";
  return { year, sessionNum, meetingKind };
}

/**
 * リンクテキスト（日付）から月・日を取得する。
 * 例: "12月12日" → { month: 12, day: 12 }
 */
export function parseDateText(text: string): { month: number; day: number } | null {
  const normalized = toHalfWidth(text.trim());
  const m = normalized.match(/(\d+)月(\d+)日/);
  if (!m) return null;
  return { month: parseInt(m[1]!, 10), day: parseInt(m[2]!, 10) };
}

/**
 * 一覧ページ HTML から PDF リンクをパースする。
 *
 * 年度ごとに 【 令和X年 】 の見出しで区切られ、
 * 各会議は 〇令和X年第Y回定例会（...） の形式で記述される。
 * PDF リンクは日付テキストに <a href="files/xxx.pdf"> として埋め込まれる。
 */
export function parseListPage(html: string): YoichiPdfLink[] {
  const results: YoichiPdfLink[] = [];

  // <a href="files/xxx.pdf"> パターンで全 PDF リンクを抽出
  // 前後のテキストから会議情報を推定するため、段落単位で処理する
  const anchorPattern = /<a\s[^>]*href="(files\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  // 全体 HTML から 〇 を含む段落を先に収集しておく
  // HTMLを strip してテキストを取り出す補助関数
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  // HTML を行ごとに分割して処理する（改行ベース）
  const lines = html.split(/\n/);
  let pendingHeading: ReturnType<typeof parseMeetingHeading> = null;

  for (const line of lines) {
    // 見出しパターン検出
    const lineText = stripTags(line);
    const heading = parseMeetingHeading(lineText);
    if (heading) {
      pendingHeading = heading;
      continue;
    }

    // PDF リンク検出
    const linkPattern = /<a\s[^>]*href="(files\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkPattern.exec(line)) !== null) {
      const href = m[1]!;
      const linkText = stripTags(m[2]!);

      // ファイル名だけを取得（files/ プレフィックスを除く）
      const filename = href.replace(/^files\//, "");
      const parsed = parseFilename(filename);

      let heldOn: string | null = null;
      let title: string;
      let meetingKind: "定例会" | "臨時会";

      if (parsed) {
        meetingKind = parsed.meetingKind;
        let year = parsed.year;
        let month = parsed.month;
        let day = parsed.day;

        // 新形式の場合は月・日がない→リンクテキストから取得
        if (month === null || day === null) {
          const dateFromText = parseDateText(linkText);
          if (dateFromText) {
            month = dateFromText.month;
            day = dateFromText.day;
          } else if (pendingHeading && pendingHeading.year) {
            // テキストに日付がなければ年だけ
            year = pendingHeading.year;
          }
        }

        if (month !== null && day !== null) {
          heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }

        const sessionNum = parsed.sessionNum;
        const dayNum = parsed.dayNum;
        title = dayNum
          ? `第${sessionNum}回${meetingKind}${dayNum}日目`
          : `第${sessionNum}回${meetingKind}`;
      } else if (pendingHeading) {
        // ファイル名からパースできない場合は見出しから推定
        meetingKind = pendingHeading.meetingKind;
        const dateFromText = parseDateText(linkText);
        if (dateFromText) {
          heldOn = `${pendingHeading.year}-${String(dateFromText.month).padStart(2, "0")}-${String(dateFromText.day).padStart(2, "0")}`;
        }
        title = `第${pendingHeading.sessionNum}回${pendingHeading.meetingKind}`;
      } else {
        continue;
      }

      const pdfUrl = `${BASE_ORIGIN}${LIST_PATH}${href}`;

      results.push({
        title,
        heldOn,
        pdfUrl,
        meetingType: detectMeetingType(meetingKind),
      });
    }
  }

  // 上記の行処理で拾えなかった場合のフォールバック（複数行にまたがるリンク等）
  // 既に追加済みの URL セットを作成
  const addedUrls = new Set(results.map((r) => r.pdfUrl));

  // HTML 全体を再スキャン
  anchorPattern.lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = anchorPattern.exec(html)) !== null) {
    const href = am[1]!;
    const pdfUrl = `${BASE_ORIGIN}${LIST_PATH}${href}`;
    if (addedUrls.has(pdfUrl)) continue;

    const linkText = stripTags(am[2]!);
    const filename = href.replace(/^files\//, "");
    const parsed = parseFilename(filename);

    if (!parsed) continue;

    let heldOn: string | null = null;
    const { sessionNum, meetingKind, dayNum } = parsed;
    let { year, month, day } = parsed;

    if (month === null || day === null) {
      const dateFromText = parseDateText(linkText);
      if (dateFromText) {
        month = dateFromText.month;
        day = dateFromText.day;
      }
    }

    if (month !== null && day !== null) {
      heldOn = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    const title = dayNum
      ? `第${sessionNum}回${meetingKind}${dayNum}日目`
      : `第${sessionNum}回${meetingKind}`;

    results.push({
      title,
      heldOn,
      pdfUrl,
      meetingType: detectMeetingType(meetingKind),
    });
    addedUrls.add(pdfUrl);
  }

  return results;
}

/**
 * 指定年度の PDF リンクを収集する。
 *
 * baseUrl から一覧ページ URL を構築し、全 PDF リンクをパースした後、
 * 対象年度のものだけをフィルタリングして返す。
 *
 * 年度判定: 4月〜翌年3月を1年度とする。
 */
export async function fetchDocumentList(
  _baseUrl: string,
  year: number
): Promise<YoichiPdfLink[]> {
  const listUrl = `${BASE_ORIGIN}${LIST_PATH}`;

  const html = await fetchPage(listUrl);
  if (!html) return [];

  const allLinks = parseListPage(html);

  // 年度フィルタ: heldOn が null のものは除外
  return allLinks.filter((link) => {
    if (!link.heldOn) return false;
    const [y, monthStr] = link.heldOn.split("-");
    const heldYear = parseInt(y!, 10);
    const month = parseInt(monthStr!, 10);

    // 1-3月は前年度に属する
    const nendo = month <= 3 ? heldYear - 1 : heldYear;
    return nendo === year;
  });
}
