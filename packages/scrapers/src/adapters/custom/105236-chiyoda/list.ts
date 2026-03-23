/**
 * 千代田町議会 — list フェーズ
 *
 * 単一の一覧ページ (gikai15.html) から全 PDF リンクを収集する。
 * ページは <h2> で年度ごとに区切られ、各年度セクション内の
 * <ul><li><a> で PDF リンクが掲載されている。
 *
 * PDF URL のパターン:
 * 1. ハッシュ型: ../files/{32桁ハッシュ}.pdf
 * 2. 日本語ファイル名: ../{URLエンコード日本語}.pdf
 * 3. 規則的ファイル名: data/T_{YYYYMM}.pdf, data/R_{YYYYMMDD}.pdf
 */

import { BASE_ORIGIN, fetchPage, toJapaneseEra } from "./shared";

export interface ChiyodaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  section: string;
}

/**
 * 一覧ページの HTML を年度セクションごとにパースし、
 * 指定年度の PDF リンク一覧を返す（テスト可能な純粋関数）。
 *
 * HTML 構造:
 *   <h2>令和７年</h2>
 *   <p><a href="../files/{hash}.pdf">令和7年 第4回定例会（12月開催）</a>（PDF/892KB)</p>
 *   <p><a href="../files/{hash}.pdf">令和7年 第2回臨時会（10月15日開催）</a>（PDF/254KB）</p>
 */
export function parseListPage(
  html: string,
  targetEraTexts: string[]
): ChiyodaMeeting[] {
  const results: ChiyodaMeeting[] = [];

  // h2 タグで年度セクションを分割
  const h2Pattern = /<h2[^>]*>(.*?)<\/h2>/gi;
  const sections: { index: number; eraText: string }[] = [];

  for (const match of html.matchAll(h2Pattern)) {
    const rawText = match[1]!.replace(/<[^>]+>/g, "").trim();
    sections.push({ index: match.index!, eraText: rawText });
  }

  // 対象年度のセクションを見つける
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    // 全角数字を半角に正規化して比較
    const normalizedEra = section.eraText.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
    const isTarget = targetEraTexts.some(
      (era) => normalizedEra.includes(era) || section.eraText.includes(era)
    );
    if (!isTarget) continue;

    // このセクションの範囲を決定（次の h2 まで）
    const sectionStart = section.index;
    const sectionEnd =
      i + 1 < sections.length ? sections[i + 1]!.index : html.length;
    const sectionHtml = html.slice(sectionStart, sectionEnd);

    // PDF リンクを抽出
    const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of sectionHtml.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const linkText = linkMatch[2]!.replace(/<[^>]+>/g, "").trim();

      // リンクテキストから会議名を抽出（PDF サイズ情報を除去）
      const meetingName = linkText
        .replace(/\(PDF[^)]*\)/gi, "")
        .replace(/（PDF[^）]*）/gi, "")
        .trim();

      if (!meetingName) continue;

      // PDF URL を構築
      const pdfUrl = resolveUrl(href);

      // 開催月を推定して heldOn を構築
      const heldOn = estimateHeldOn(section.eraText, meetingName);
      if (!heldOn) continue;

      // タイトル構築: リンクテキストに和暦年が含まれている場合はそのまま使う
      // 含まれていない場合は h2 の年度を先頭に付ける
      const hasEraInName = /(?:令和|平成)/.test(meetingName);
      const meetingTitle = hasEraInName
        ? meetingName
        : `${section.eraText} ${meetingName}`;

      results.push({
        pdfUrl,
        title: meetingTitle,
        heldOn,
        section: meetingName,
      });
    }
  }

  return results;
}

/**
 * 相対パスの PDF URL を絶対 URL に変換する。
 * 一覧ページの URL: https://www.town.chiyoda.gunma.jp/gikai/gikai15.html
 * 相対パス: ../files/{hash}.pdf → https://www.town.chiyoda.gunma.jp/files/{hash}.pdf
 *           data/T_201701.pdf → https://www.town.chiyoda.gunma.jp/gikai/data/T_201701.pdf
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;

  // ../files/ → /files/
  if (href.startsWith("../")) {
    const relative = href.replace(/^\.\.\//, "");
    return `${BASE_ORIGIN}/${relative}`;
  }

  // data/T_201701.pdf → /gikai/data/T_201701.pdf
  if (href.startsWith("data/")) {
    return `${BASE_ORIGIN}/gikai/${href}`;
  }

  // その他の相対パス
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }

  return `${BASE_ORIGIN}/gikai/${href}`;
}

/**
 * 和暦テキストと会議名から開催日 (YYYY-MM-DD) を推定する。
 *
 * 実際のリンクテキスト例:
 *   "令和7年 第4回定例会（12月開催）" → YYYY-12-01
 *   "令和7年 第2回臨時会（10月15日開催）" → YYYY-10-15
 *   "第1回定例会（3月）" → YYYY-03-01
 *   "第1回臨時会（5月1日開催）" → YYYY-05-01
 */
export function estimateHeldOn(
  eraText: string,
  meetingName: string
): string | null {
  // まず meetingName 内に和暦年があればそれを使う（リンクテキストに含まれる場合）
  const meetingYear = eraToWesternYear(meetingName);
  const westernYear = meetingYear ?? eraToWesternYear(eraText);
  if (!westernYear) return null;

  // 全角数字を半角に変換してからマッチ
  const normalized = meetingName.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 月日パターン: （12月15日） or （12月15日開催）
  const dayMatch = normalized.match(/[（(](\d{1,2})月(\d{1,2})日(?:開催)?[）)]/);
  if (dayMatch) {
    const month = parseInt(dayMatch[1]!, 10);
    const day = parseInt(dayMatch[2]!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 月のみパターン: （12月） or （12月開催）
  const monthMatch = normalized.match(/[（(](\d{1,2})月(?:開催)?[）)]/);
  if (monthMatch) {
    const month = parseInt(monthMatch[1]!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  // 月情報なし
  return `${westernYear}-01-01`;
}

/**
 * 和暦テキストから西暦年を返す。
 * "令和７年" → 2025, "平成30年" → 2018
 */
export function eraToWesternYear(eraText: string): number | null {
  // 全角数字を半角に変換
  const normalized = eraText.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const reiwaMatch = normalized.match(/令和(\d+)年/);
  if (reiwaMatch) return parseInt(reiwaMatch[1]!, 10) + 2018;

  if (normalized.includes("令和元年")) return 2019;

  const heiseiMatch = normalized.match(/平成(\d+)年/);
  if (heiseiMatch) return parseInt(heiseiMatch[1]!, 10) + 1988;

  if (normalized.includes("平成元年")) return 1989;

  return null;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<ChiyodaMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const eraTexts = toJapaneseEra(year);
  return parseListPage(html, eraTexts);
}
