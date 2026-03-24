/**
 * 栗山町議会 — list フェーズ
 *
 * 一覧ページ https://www.town.kuriyama.hokkaido.jp/site/gikai/7389.html（UTF-8）を
 * パースし、全会議録の URL・タイトル・形式を収集する。
 *
 * <div id="main_body"> 内の <h3> タグで年度を識別し、
 * 各 <ul> 内の <a> タグからリンク先を抽出する。
 * HTML 形式（/gikai/minutes/）と PDF 形式（/uploaded/attachment/）を分類する。
 */

import { LIST_PAGE_URL, detectMeetingType, fetchPage, parseDateString, resolveUrl } from "./shared";

export interface KuriyamaMinutesLink {
  /** 年度文字列（例: "令和7年"） */
  yearLabel: string;
  /** 会期名（例: "6月定例会議"） */
  sessionName: string;
  /** 絶対 URL */
  url: string;
  /** HTML 形式 or PDF 形式 */
  format: "html" | "pdf";
  /** 会議種別 */
  meetingType: string;
}

/**
 * 一覧ページ HTML から会議録リンクをパースする。
 */
export function parseListPage(html: string): KuriyamaMinutesLink[] {
  const links: KuriyamaMinutesLink[] = [];

  // <div id="main_body"> を切り出す
  const mainBodyMatch = html.match(/<div[^>]+id=["']main_body["'][^>]*>([\s\S]*?)<\/div>/i);
  const body = mainBodyMatch ? mainBodyMatch[1]! : html;

  // <h3>〜</h3> で年度を識別しながら後続の <ul> のリンクを収集
  // セクション: <h3>年度</h3> ... <ul>...</ul>
  const sectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;

  for (const sectionMatch of body.matchAll(sectionPattern)) {
    const yearLabel = sectionMatch[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, "")
      .trim();
    const sectionBody = sectionMatch[2]!;

    // <a href="...">テキスト</a> を抽出
    const aPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const aMatch of sectionBody.matchAll(aPattern)) {
      const href = aMatch[1]!.trim();
      const text = aMatch[2]!
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!href || !text) continue;

      // HTML 形式: /gikai/minutes/kaigiroku/
      // PDF 形式: /uploaded/attachment/
      let format: "html" | "pdf";
      if (href.includes("/gikai/minutes/")) {
        format = "html";
      } else if (href.includes("/uploaded/attachment/") || href.endsWith(".pdf")) {
        format = "pdf";
      } else {
        continue; // 対象外リンク
      }

      const url = resolveUrl(href, LIST_PAGE_URL);

      links.push({
        yearLabel,
        sessionName: text,
        url,
        format,
        meetingType: detectMeetingType(text),
      });
    }
  }

  return links;
}

/**
 * 年ラベル（例: "令和7年"）から西暦を抽出する。
 */
export function extractYearFromLabel(label: string): number | null {
  // 「令和7年」または「令和７年」
  const normalized = label.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const m = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!m) return null;
  const n = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  if (m[1] === "令和") return 2018 + n;
  if (m[1] === "平成") return 1988 + n;
  return null;
}

/**
 * 指定年の会議録リンク一覧を取得する。
 *
 * 年度ラベルが指定年または指定年-1 に対応するセクションを対象とする
 * （前年度会議が翌年掲載されることがある）。
 */
export async function fetchMinutesLinks(
  year: number,
): Promise<KuriyamaMinutesLink[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];

  const allLinks = parseListPage(html);

  return allLinks.filter((link) => {
    const labelYear = extractYearFromLabel(link.yearLabel);
    if (labelYear === null) return false;
    // 指定年と前後1年を含める（3月会議は前年度として掲載されることがある）
    return labelYear === year || labelYear === year - 1;
  });
}

export { parseDateString };
