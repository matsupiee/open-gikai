/**
 * 三股町議会 会議録 — list フェーズ
 *
 * 会議録トップページから年度別ページ URL を収集し、
 * 各年度ページから PDF リンクとメタ情報を収集する。
 *
 * 各 PDF が1つの MeetingData に対応する。
 * fetchDetail は PDF をダウンロード・テキスト抽出して発言を返す。
 */

import {
  BASE_ORIGIN,
  YEAR_CONTENT_URLS,
  detectMeetingType,
  parsePdfFilenameToDate,
  fetchPage,
  delay,
} from "./shared";

export interface MimataMeeting {
  /** 会議タイトル（例: "令和7年9月定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 年度ページ HTML から PDF リンクを抽出する。
 * PDF リンクは `/upload/file/09gikai/` 配下を指す。
 */
export function parsePdfLinks(html: string): MimataMeeting[] {
  const results: MimataMeeting[] = [];

  // PDF へのアンカータグを抽出
  const pdfPattern =
    /<a\s[^>]*href="([^"]*\/upload\/file\/09gikai\/[^"]*\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!.trim();
    const rawText = m[2]!
      .replace(/\(PDF[^)]*\)/g, "")
      .replace(/（PDF[^）]*）/g, "")
      .trim();

    if (!href) continue;

    // 絶対 URL に変換
    const pdfUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    // ファイル名をデコードしてメタ情報を抽出
    const urlPath = new URL(pdfUrl).pathname;
    const encodedFilename = urlPath.split("/").pop() ?? "";
    const filename = decodeURIComponent(encodedFilename).replace(/\.pdf$/i, "");

    // タイトルはリンクテキストを優先、なければファイル名
    const title = rawText || filename;
    if (!title) continue;

    // 一般質問の別 PDF はスキップしない（発言データが含まれるため収録）
    const heldOn = parsePdfFilenameToDate(filename);
    const meetingType = detectMeetingType(title || filename);

    results.push({
      title,
      heldOn,
      pdfUrl,
      meetingType,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 * 年度別ページから PDF リンクを収集する。
 */
export async function fetchMeetingList(year: number): Promise<MimataMeeting[]> {
  const entry = YEAR_CONTENT_URLS.find((e) => e.year === year);
  if (!entry) return [];

  const url = `${BASE_ORIGIN}${entry.contentPath}`;
  const html = await fetchPage(url);
  if (!html) return [];

  await delay(INTER_PAGE_DELAY_MS);

  return parsePdfLinks(html);
}
