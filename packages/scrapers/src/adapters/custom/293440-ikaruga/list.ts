/**
 * 斑鳩町議会 会議録 — list フェーズ
 *
 * 8つの会議種別ページから PDF リンクとメタ情報を収集する。
 *
 * ページ構造:
 *   <h2>令和7年</h2>
 *   ... (会議名テキスト)
 *   <a href="./cmsfiles/contents/0000000/419/r07031nichime.pdf">第1日目</a>
 *
 * 年度は <h2> 見出しから取得する。
 * 会議名（例: 「3月定例会」「5月臨時会」）はリンク直前の周辺テキストから取得する。
 */

import { BASE_ORIGIN, LIST_PAGES, eraToWesternYear, fetchPage, type PageDef } from "./shared";

export interface IkarugaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "本会議 令和7年3月定例会 第1日目"） */
  title: string;
  /** 開催年 西暦（日付が特定できる場合は YYYY-MM-DD、不明な場合は YYYY-01-01） */
  heldOn: string;
  /** 会議種別カテゴリ（plenary / committee） */
  category: string;
  /** ページの会議種別ラベル */
  pageLabel: string;
}

/**
 * 一覧ページの HTML から PDF リンクを抽出する。
 *
 * HTML を解析して <h2> で年度を取得し、
 * `./cmsfiles/contents/` で始まる PDF href を持つ a タグを収集する。
 * リンク直前のテキストから会議名を特定する。
 * 目次 PDF（リンクテキストに「目次」を含む）はスキップする。
 */
export function parseListPage(html: string, pageDef: PageDef): IkarugaMeeting[] {
  const results: IkarugaMeeting[] = [];

  // HTML を h2 セクションに分割して年度を特定する
  // h2 タグを見出しとして使用
  const h2Pattern = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches = [...html.matchAll(h2Pattern)];

  // h2 が存在しない場合は全体を処理（年度は PDF リンクから推定）
  if (h2Matches.length === 0) {
    return parseSectionHtml(html, null, pageDef, results);
  }

  for (let i = 0; i < h2Matches.length; i++) {
    const h2Match = h2Matches[i]!;
    const h2Text = h2Match[1]!.replace(/<[^>]+>/g, "").trim();
    const sectionYear = eraToWesternYear(h2Text);

    const startIdx = h2Match.index! + h2Match[0].length;
    const endIdx = i + 1 < h2Matches.length ? h2Matches[i + 1]!.index! : html.length;
    const sectionHtml = html.slice(startIdx, endIdx);

    parseSectionHtml(sectionHtml, sectionYear, pageDef, results);
  }

  return results;
}

/**
 * セクション HTML から PDF リンクを抽出する。
 */
function parseSectionHtml(
  sectionHtml: string,
  sectionYear: number | null,
  pageDef: PageDef,
  results: IkarugaMeeting[],
): IkarugaMeeting[] {
  // PDF リンクのパターン: href="./cmsfiles/contents/..." または href="/cmsfiles/contents/..."
  const linkPattern =
    /<a[^>]+href="(\.\/cmsfiles\/contents\/[^"]+\.pdf|\/cmsfiles\/contents\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of sectionHtml.matchAll(linkPattern)) {
    const pdfPath = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 目次はスキップ
    if (linkText.includes("目次")) continue;

    // 絶対 URL に変換
    const pdfUrl = pdfPath.startsWith("/")
      ? `${BASE_ORIGIN}${pdfPath}`
      : `${BASE_ORIGIN}${pdfPath.slice(1)}`; // "./cmsfiles..." → "/cmsfiles..."

    // リンク前のコンテキストから会議名を取得
    const linkIndex = sectionHtml.indexOf(match[0]);
    const beforeText = sectionHtml.slice(Math.max(0, linkIndex - 500), linkIndex);
    const meetingName = extractMeetingName(beforeText);

    // 年度から開催日を推定
    const heldOn = buildHeldOn(sectionYear, meetingName);

    const title = meetingName
      ? `${pageDef.label} ${meetingName} ${linkText}`
      : `${pageDef.label} ${linkText}`;

    results.push({
      pdfUrl,
      title: title.replace(/\s+/g, " ").trim(),
      heldOn,
      category: pageDef.category,
      pageLabel: pageDef.label,
    });
  }

  return results;
}

/**
 * リンク前のテキストから最も近い会議名を抽出する。
 * 例: "3月定例会", "5月臨時会", "12月定例会"
 */
function extractMeetingName(beforeText: string): string {
  // HTML タグを除去してプレーンテキストに
  const plain = beforeText
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

  // 直前の会議名パターンを探す（最後にマッチしたものを使用）
  // パターン: XX月定例会、XX月臨時会、委員会名など
  const patterns = [
    /(\d+月(?:定例会|臨時会))/g,
    /((?:令和|平成)(?:元|\d+)年)/g,
  ];

  for (const pattern of patterns) {
    const matches = [...plain.matchAll(pattern)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1]!;
      return last[1]!;
    }
  }

  return "";
}

/**
 * 年度と会議名から開催日（YYYY-MM-DD 形式）を推定する。
 * 会議名から月が特定できれば YYYY-MM-01、できなければ YYYY-01-01 を返す。
 * 年度が不明な場合は null を返す。
 */
export function buildHeldOn(year: number | null, meetingName: string): string {
  if (!year) return "";

  // 会議名から月を抽出（例: "3月定例会" → 3）
  const monthMatch = meetingName.match(/^(\d+)月/);
  if (monthMatch) {
    const month = parseInt(monthMatch[1]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return `${year}-01-01`;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 全一覧ページを巡回し、対象年のエントリのみ返す。
 */
export async function fetchMeetingList(year: number): Promise<IkarugaMeeting[]> {
  const allMeetings: IkarugaMeeting[] = [];

  for (const pageDef of LIST_PAGES) {
    const url = `${BASE_ORIGIN}${pageDef.url}`;
    const html = await fetchPage(url);
    if (!html) continue;

    const meetings = parseListPage(html, pageDef);

    // 対象年でフィルタ
    for (const m of meetings) {
      if (!m.heldOn) continue;
      const meetingYear = parseInt(m.heldOn.slice(0, 4), 10);
      if (meetingYear === year) {
        allMeetings.push(m);
      }
    }
  }

  return allMeetings;
}
