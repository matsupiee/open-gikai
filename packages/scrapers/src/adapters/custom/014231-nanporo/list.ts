/**
 * 南幌町議会 — list フェーズ
 *
 * 単一の一覧ページから会議録・一般質問の PDF リンクを収集する。
 *
 * ページ構造:
 *   <h2> 議案・会議結果・会議録　令和X年（YYYY年）  ← 年度
 *     <h3> 定例会 / 臨時会                           ← 会議種別
 *       <h4> 第N回定例会 / 第N回臨時会               ← 個別の会
 *         <p> YYYY年（令和X年）M月D日～D日           ← 開催日
 *         <div class="wp-block-file">               ← PDF リンク
 *           <a href="...">会議録</a>
 *           <a href="..." class="wp-block-file__button" download>ダウンロード</a>
 *         </div>
 *
 * 対象リンク: リンクテキストが「会議録」または「一般質問」のもの
 */

import { fetchPage, eraToWestern, normalizeFullWidth } from "./shared";

export interface NanporoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  pdfType: "会議録" | "一般質問";
}

/**
 * h2 テキストと h4 テキストから会議タイトルを生成する。
 *
 * 例:
 *   h2: "議案・会議結果・会議録　令和7年（2025年）"
 *   h4: "第１回定例会"
 *   → "令和7年第1回定例会"
 */
export function buildTitle(h2Text: string, h4Text: string): string {
  const normalized2 = normalizeFullWidth(h2Text);
  const normalized4 = normalizeFullWidth(h4Text);

  // h2 から和暦年を抽出
  const eraMatch = normalized2.match(/(令和|平成|昭和)(元|\d+)年/);
  if (eraMatch) {
    const eraPrefix = `${eraMatch[1]}${eraMatch[2]}年`;
    return `${eraPrefix}${normalized4}`;
  }

  return `${normalized4}`;
}

/**
 * 開催日テキスト（例: "2025年（令和7年）3月5日～13日"）から
 * YYYY-MM-DD 形式の日付を生成する。
 *
 * 解析できない場合は null を返す（"1970-01-01" 禁止）。
 */
export function parseHeldOn(text: string): string | null {
  const normalized = normalizeFullWidth(text);

  // パターン1: "YYYY年（令和X年）M月D日" (西暦が先)
  const westernFirst = normalized.match(/(\d{4})年[（(][^）)]*[）)](\d+)月(\d+)日/);
  if (westernFirst) {
    const year = parseInt(westernFirst[1]!, 10);
    const month = parseInt(westernFirst[2]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  // パターン2: "(令和|平成)(元|\d+)年.*?M月D日" (和暦が先)
  const eraFirst = normalized.match(/(令和|平成|昭和)(元|\d+)年.*?(\d+)月(\d+)日/);
  if (eraFirst) {
    const westernYear = eraToWestern(eraFirst[1]!, eraFirst[2]!);
    const month = parseInt(eraFirst[3]!, 10);
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * HTML タグを除去してプレーンテキストを返す。
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

/**
 * 一覧ページの HTML から会議録・一般質問の PDF リンクを抽出する。
 *
 * regex ベースで HTML を走査し、h2・h4 見出しと wp-block-file ブロックを処理する。
 * リンクテキストが「会議録」または「一般質問」のものだけを対象にする。
 *
 * 対象年: year 引数で指定した西暦年に一致する h2 セクションのみ。
 */
export function parseMeetingList(html: string, year: number): NanporoMeeting[] {
  const results: NanporoMeeting[] = [];

  // h2 セクションで分割する
  // 各セクション: <h2>テキスト</h2> + 以降の内容（次の <h2> まで）
  const h2SectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;

  for (const sectionMatch of html.matchAll(h2SectionPattern)) {
    const h2Text = stripTags(sectionMatch[1]!);
    const sectionBody = sectionMatch[2]!;

    // h2 から西暦年を抽出して対象年かチェック
    const normalizedH2 = normalizeFullWidth(h2Text);
    const yearMatch = normalizedH2.match(/(\d{4})年/);
    if (!yearMatch) continue;
    const sectionYear = parseInt(yearMatch[1]!, 10);
    if (sectionYear !== year) continue;

    // セクション内を h4 ブロックに分割
    // h4 ブロック: <h4>テキスト</h4> + 以降の内容（次の <h4> まで）
    const h4BlockPattern = /<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4|<h3|<h2|$)/gi;

    for (const h4Match of sectionBody.matchAll(h4BlockPattern)) {
      const h4Text = stripTags(h4Match[1]!);
      const h4Body = h4Match[2]!;

      // 開催日テキストを <p> タグから抽出
      let heldOn: string | null = null;
      const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      for (const pMatch of h4Body.matchAll(pPattern)) {
        const pText = stripTags(pMatch[1]!);
        const normalizedP = normalizeFullWidth(pText);
        if (/\d+年.*?\d+月\d+日/.test(normalizedP)) {
          heldOn = parseHeldOn(pText);
          break;
        }
      }

      // wp-block-file ブロック内のリンクを抽出
      const fileBlockPattern = /<div[^>]*class="[^"]*wp-block-file[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
      for (const fileMatch of h4Body.matchAll(fileBlockPattern)) {
        const fileBody = fileMatch[1]!;

        // 最初の <a> タグのテキストと href を取得
        const aMatch = fileBody.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!aMatch) continue;

        const href = aMatch[1]!;
        const linkText = stripTags(aMatch[2]!);

        if (linkText !== "会議録" && linkText !== "一般質問") continue;

        const title = buildTitle(h2Text, h4Text);
        results.push({
          pdfUrl: href,
          title,
          heldOn,
          pdfType: linkText as "会議録" | "一般質問",
        });
      }
    }
  }

  return results;
}

/**
 * 指定年の会議録・一般質問リストを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<NanporoMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseMeetingList(html, year);
}
