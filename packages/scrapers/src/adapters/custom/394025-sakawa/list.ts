/**
 * 佐川町議会 — list フェーズ
 *
 * 2段階クロールで年度別ページから PDF リンクとメタ情報を抽出する。
 *
 * Step 1: 議事録一覧ページ（hdnKey=1076）から年度別ページの hdnKey を収集
 * Step 2: 各年度ページ（dtl.php?hdnKey={年度ID}）から PDF リンクと h3 見出しを収集
 *
 * ページ構造:
 *   <h3>3月定例会</h3>
 *   <p class="icon-pdf"><a href="/file/?t=LD&id=2673&fid=16512">1日目（PDF：555KB）</a></p>
 *   <p class="icon-pdf"><a href="/file/?t=LD&id=2673&fid=16513">4日目（PDF：703KB）</a></p>
 *   ...
 *   <h3>第1回臨時会</h3>
 *   <p class="icon-pdf"><a href="/file/?t=LD&id=2673&fid=15795">第1回臨時会（PDF：277KB）</a></p>
 */

import { BASE_ORIGIN, LIST_URL, fetchPage } from "./shared";

export interface SakawaMeeting {
  pdfUrl: string;
  /** h3 見出しから取得した会議名（例: "3月定例会", "第1回臨時会"） */
  meetingName: string;
  /** リンクテキスト（例: "1日目（PDF：555KB）"） */
  linkText: string;
  /** 年度ページの hdnKey */
  pageId: string;
  /** PDF ファイル ID（fid） */
  fileId: string;
}

/**
 * 議事録一覧ページの HTML から年度別ページの hdnKey を抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - `dtl.php?hdnKey={ID}` 形式のリンクで hdnKey=1076 以外のもの
 */
export function parseYearPageIds(html: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /dtl\.php\?hdnKey=(\d+)/gi;

  for (const match of html.matchAll(linkPattern)) {
    const hdnKey = match[1]!;
    // インデックスページ自身（1076）は除外
    if (hdnKey === "1076") continue;
    if (seen.has(hdnKey)) continue;
    seen.add(hdnKey);
    results.push(hdnKey);
  }

  return results;
}

/**
 * 年度別ページの HTML から会議名と PDF ダウンロードリンクを抽出する（テスト可能な純粋関数）。
 *
 * ページ構造:
 *   <h3>3月定例会</h3>
 *   <p class="icon-pdf"><a href="/file/?t=LD&id=2673&fid=16512">1日目（PDF：555KB）</a></p>
 *   ...
 *
 * h3 タグの内容を currentMeetingName として保持しながら、直後の PDF リンクに付与する。
 */
export function parseYearPage(html: string, pageId: string): SakawaMeeting[] {
  const results: SakawaMeeting[] = [];
  const seen = new Set<string>();

  // h3 タグと icon-pdf リンクを順番に処理するため、行ごとに解析
  // h3 と pdf リンクが混在した HTML を上から順番にスキャンする
  let currentMeetingName = "";

  // h3 タグと pdf リンクを含むノードを正規表現で順番に抽出
  const nodePattern =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<a[^>]+href="([^"]*\/file\/\?t=LD&(?:amp;)?id=\d+&(?:amp;)?fid=(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(nodePattern)) {
    if (match[0]!.startsWith("<h3")) {
      // h3 タグ: 会議名を更新
      const h3Inner = match[1]!;
      currentMeetingName = h3Inner
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/[\s　]+/g, " ")
        .trim();
    } else {
      // PDF リンク
      const href = match[2]!;
      const fileId = match[3]!;
      const linkHtml = match[4]!;
      const linkText = linkHtml
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[\s　]+/g, " ")
        .trim();

      if (!fileId) continue;

      // href の HTML エンティティを元に戻す
      const decodedHref = href.replace(/&amp;/g, "&");
      let pdfUrl: string;
      if (decodedHref.startsWith("http")) {
        pdfUrl = decodedHref;
      } else if (decodedHref.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${decodedHref}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${decodedHref}`;
      }

      if (seen.has(pdfUrl)) continue;
      seen.add(pdfUrl);

      results.push({
        pdfUrl,
        meetingName: currentMeetingName,
        linkText,
        pageId,
        fileId,
      });
    }
  }

  return results;
}

/**
 * h3 見出しの会議名からタイトル文字列を生成する。
 *
 * 佐川町の会議名パターン:
 *   "3月定例会"    → "3月定例会"
 *   "第1回臨時会"  → "第1回臨時会"
 *   "12月定例会"   → "12月定例会"
 *
 * リンクテキスト（例: "1日目（PDF：555KB）"）も組み合わせてタイトルを生成する。
 */
export function buildMeetingTitle(meetingName: string, linkText: string): string {
  if (!meetingName) return linkText || "佐川町議会 会議録";

  // linkText から PDF サイズ情報を除去
  const cleanedLinkText = linkText.replace(/（PDF[：:][^）)]*[）)]|\[PDF[^\]]*\]/g, "").trim();

  // 日目情報があれば組み合わせる（例: "3月定例会 1日目"）
  // 臨時会の場合はリンクテキストが会議名と同じなので meetingName のみ
  if (cleanedLinkText && cleanedLinkText !== meetingName) {
    return `${meetingName} ${cleanedLinkText}`;
  }

  return meetingName;
}

/**
 * 年度ページの h1 タイトルから西暦年を推定する。
 *
 * 佐川町の年度ページ h1 パターン:
 *   "令和６年（議事録）" → 2024
 *   "令和7年（議事録）" → 2025
 *   "平成30年（議事録）" → 2018
 *
 * 解析できない場合は null を返す。
 */
export function parseYearFromPageTitle(html: string): number | null {
  // 全角数字を半角に変換
  const normalized = html.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 指定年の全 PDF リンクを取得する（2段階クロール）。
 *
 * Step 1: 一覧ページから年度別ページ ID を収集
 * Step 2: 各年度ページから PDF リンクを収集し、h1 タイトルの年で year をフィルタリング
 */
export async function fetchMeetingList(year: number): Promise<SakawaMeeting[]> {
  const indexHtml = await fetchPage(LIST_URL);
  if (!indexHtml) return [];

  const pageIds = parseYearPageIds(indexHtml);
  const allMeetings: SakawaMeeting[] = [];

  for (const pageId of pageIds) {
    const yearPageUrl = `${BASE_ORIGIN}/life/dtl.php?hdnKey=${pageId}`;
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    // h1 タイトルから年度を確認して year でフィルタリング
    const pageYear = parseYearFromPageTitle(yearHtml);
    if (pageYear !== null && pageYear !== year) continue;

    const meetings = parseYearPage(yearHtml, pageId);
    allMeetings.push(...meetings);
  }

  return allMeetings;
}
