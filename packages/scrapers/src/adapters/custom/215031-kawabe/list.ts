/**
 * 川辺町議会（岐阜県） — list フェーズ
 *
 * インデックスページ（https://www.kawabe-gifu.jp/?page_id=48191）から
 * wp-content/uploads/ 配下の PDF リンクを収集する。
 *
 * 1 ページに全年号の PDF リンクが列挙されているため、
 * 1 回のリクエストで全リンクを取得できる。
 */

import { INDEX_URL, fetchPage, toJapaneseEra } from "./shared";

export interface KawabeMeeting {
  pdfUrl: string;
  /** リンクテキスト（例: "令和６年第４回定例会"） */
  linkText: string;
  /** アップロード年（URL パスから抽出） */
  uploadYear: number;
  /** アップロード月（URL パスから抽出） */
  uploadMonth: number;
}

/**
 * インデックスページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 対象: href に wp-content/uploads/ を含む <a> タグ
 * URL パス形式: /wp-content/uploads/{year}/{month}/{filename}.pdf
 */
export function parseListPage(html: string): KawabeMeeting[] {
  const results: KawabeMeeting[] = [];

  // <a href="...wp-content/uploads/{year}/{month}/...pdf">リンクテキスト</a> を抽出
  const linkRegex =
    /<a[^>]+href="([^"]*wp-content\/uploads\/(\d{4})\/(\d{2})\/[^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const uploadYear = Number(match[2]);
    const uploadMonth = Number(match[3]);
    const linkText = match[4]!.trim().replace(/\s+/g, " ");

    if (!linkText) continue;

    const pdfUrl = href.startsWith("http")
      ? href
      : `https://www.kawabe-gifu.jp${href.startsWith("/") ? "" : "/"}${href}`;

    results.push({
      pdfUrl,
      linkText,
      uploadYear,
      uploadMonth,
    });
  }

  return results;
}

/**
 * リンクテキスト・URL パスから年を特定する。
 *
 * 優先順位:
 * 1. リンクテキスト内の「令和X年」「平成X年」
 * 2. URL パスのアップロード年（ファイルは前年のアップロードもあるため補助的に使用）
 */
export function resolveYear(meeting: KawabeMeeting): number | null {
  // リンクテキストから和暦を抽出
  const eraMatch = meeting.linkText.match(/(令和|平成)(元|[\d０-９]+)年/);
  if (eraMatch) {
    const era = eraMatch[1]!;
    const rawYear = eraMatch[2]!;
    // 全角 → 半角
    const halfYear = rawYear === "元" ? "1" : rawYear.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );
    const eraYear = Number(halfYear);
    if (era === "令和") return eraYear + 2018;
    if (era === "平成") return eraYear + 1988;
  }

  // URL パスのアップロード年を使用
  // 注: 第4回定例会（12月）の議事録は翌年1〜2月にアップロードされる場合がある
  // その場合はアップロード年 - 1 が開催年に近い
  return null;
}

/**
 * 指定年の PDF リンクを取得する。
 */
export async function fetchMeetingList(year: number): Promise<KawabeMeeting[]> {
  const html = await fetchPage(INDEX_URL);
  if (!html) return [];

  const allMeetings = parseListPage(html);
  const eraTexts = toJapaneseEra(year);

  // リンクテキストに対象年の和暦が含まれるものをフィルタ
  // リンクテキストに年号がない場合は、アップロード年を補助的に使用
  return allMeetings.filter((m) => {
    // リンクテキストに明示的な年号が含まれる場合
    if (eraTexts.some((era) => m.linkText.includes(era))) return true;

    // リンクテキストに年号がない場合 → アップロード年ベースで判定
    // 例: "第３回定例会（9.9-19）HP用.pdf" → 年号なし → アップロード年で判断
    const hasEraInText = /(令和|平成)(元|[\d０-９]+)年/.test(m.linkText);
    if (!hasEraInText) {
      // アップロード年が対象年と一致、またはアップロード年 - 1 が対象年（第4回定例会の翌年掲載）
      if (m.uploadYear === year || m.uploadYear - 1 === year) {
        // アップロード月でさらに絞り込み
        // - uploadYear === year: 月問わず対象
        // - uploadYear === year + 1: 1〜2月アップロードは前年第4回定例会
        if (m.uploadYear === year) return true;
        if (m.uploadYear === year + 1 && m.uploadMonth <= 2) return true;
      }
      return false;
    }

    return false;
  });
}
