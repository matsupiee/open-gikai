/**
 * 嘉島町議会 — list フェーズ
 *
 * 会議録一覧ページ（/q/list/282.html）から記事 ID・タイトル・公開日を収集する。
 * ページネーションなし（全件が 1 ページに表示）。
 */

import { BASE_ORIGIN, LIST_URL, detectMeetingType, fetchPage, parsePublishedDate } from "./shared";

export interface KashimaListRecord {
  /** 記事 ID（URL パスの数値部分） */
  articleId: string;
  /** 会議録タイトル */
  title: string;
  /** 詳細ページ URL */
  detailUrl: string;
  /** 公開日 YYYY-MM-DD（一覧ページから取得） */
  publishedDate: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 一覧ページ HTML から会議録エントリを抽出する。
 *
 * サイト構造（EUC-JP → UTF-8 変換済み）:
 * ```html
 * <h3>
 *   <span class="listDate">[2024年12月10日]&nbsp;</span>
 *   <span class="listTitle">
 *     <a href="/q/aview/282/4817.html" title="...">タイトル</a>
 *   </span>
 * </h3>
 * ```
 *
 * 各エントリは <h3> ブロック内にまとまっているため、
 * <h3> ブロックを単位として日付とリンクをペアで抽出する。
 */
export function parseListPage(html: string): KashimaListRecord[] {
  const records: KashimaListRecord[] = [];
  const seen = new Set<string>();

  // <h3> ブロックを分割単位として使う
  const blocks = html.split(/(?=<h3[>\s])/i);

  for (const block of blocks) {
    // ブロック内に /q/aview/282/{id}.html リンクがあるか確認
    // href はパス形式（/q/aview/282/...）またはフル URL 形式（https://...）の両方に対応
    const linkMatch = block.match(
      /<a\s[^>]*href="([^"]*\/q\/aview\/282\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkMatch) continue;

    const href = linkMatch[1]!;
    const articleId = linkMatch[2]!;
    const rawTitle = linkMatch[3]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();

    if (!articleId || !rawTitle) continue;
    if (seen.has(articleId)) continue;
    seen.add(articleId);

    const detailUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href}`;

    // ブロック内の公開日を探す（[YYYY年M月D日] または YYYY/MM/DD 形式）
    const dateMatch = block.match(/(\d{4}年\d{1,2}月\d{1,2}日|\d{4}\/\d{2}\/\d{2})/);
    const publishedDate = dateMatch ? parsePublishedDate(dateMatch[1]!) : null;
    if (!publishedDate) continue;

    records.push({
      articleId,
      title: rawTitle,
      detailUrl,
      publishedDate,
      meetingType: detectMeetingType(rawTitle),
    });
  }

  return records;
}

/**
 * 指定年の会議録一覧を取得する。
 * 公開日ベースでフィルタリングする。
 */
export async function fetchArticleList(year: number): Promise<KashimaListRecord[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);

  // 指定年の公開日のものだけを返す
  return all.filter((r) => r.publishedDate.startsWith(String(year)));
}
