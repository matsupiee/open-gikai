/**
 * 河合町議会 — list フェーズ
 *
 * 2段階クロール:
 *   1. インデックスページ (/10/1_1/1/2/index.html) から年度別ページ URL を収集
 *   2. 年度別ページから PDF リンクを収集
 *
 * HTML 構造（年度別ページ）:
 *   <h3>第N回（M月）定例会</h3>
 *   <li><a href="//www.town.kawai.nara.jp/material/files/group/9/xxx.pdf">
 *     （M月D日 種別） (PDFファイル: サイズ)
 *   </a></li>
 */

import {
  BASE_ORIGIN,
  INDEX_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface KawaiSessionInfo {
  /** 会議タイトル（例: "第3回（9月）定例会 9月6日 初日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * インデックスページから指定年度の年度別ページ URL を抽出する。
 */
export function parseYearPageUrls(html: string, targetYear: number): string[] {
  const urls: string[] = [];

  // <a href="..."> 定例会 会議録 令和X年 </a> のパターン
  const linkRegex = /href="([^"]+\/\d+[^"]*\.html)"[^>]*>([^<]*(?:令和|平成)\d*年[^<]*)</gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const text = match[2]!;

    const year = parseWarekiYear(text);
    if (year !== targetYear) continue;

    // 相対 URL を絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("//")) {
      url = `https:${href}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      continue;
    }

    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 年度別ページから PDF リンクを収集する。
 *
 * <h2> 見出しでセクションを分割し、各セクション内の PDF リンクを抽出する。
 * 実際の HTML 構造:
 *   <h2><span ...><span ...><span ...>第N回M月（定例会）</span></span></span></h2>
 *   <p class="file-link-item"><a class="pdf" href="//...pdf">（M月D日種別） (PDFファイル: サイズ)</a></p>
 */
export function parseYearPage(html: string, year: number): KawaiSessionInfo[] {
  const records: KawaiSessionInfo[] = [];
  const seen = new Set<string>();

  // h2 セクションで分割して処理
  // <h2>...</h2> ... 次の <h2> まで
  const sectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/body|$)/gi;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const h3Text = sectionMatch[1]!.replace(/<[^>]+>/g, "").trim();
    const sectionHtml = sectionMatch[2]!;

    // h3 テキストから回次・月を抽出
    // 例: "第3回（9月）定例会" or "第3回9月（定例会）"
    const sessionMatch = h3Text.match(/第(\d+)回[（(]?(\d+)月[）)]?(?:（?(定例会|臨時会)[）)]?)?/);
    const sessionNumber = sessionMatch?.[1] ? parseInt(sessionMatch[1], 10) : null;
    const sessionMonth = sessionMatch?.[2] ? parseInt(sessionMatch[2], 10) : null;
    const sessionTypeText = sessionMatch?.[3] ?? h3Text;

    const meetingType = detectMeetingType(sessionTypeText);

    // PDF リンクを抽出
    const pdfPattern =
      /href="([^"]*\/material\/files\/group\/9\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const pdfMatch of sectionHtml.matchAll(pdfPattern)) {
      const rawHref = pdfMatch[1]!;
      const rawText = pdfMatch[2]!.replace(/\s+/g, " ").trim();

      // プロトコル相対 URL を https: に補完
      let pdfUrl: string;
      if (rawHref.startsWith("//")) {
        pdfUrl = `https:${rawHref}`;
      } else if (rawHref.startsWith("http")) {
        pdfUrl = rawHref;
      } else if (rawHref.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${rawHref}`;
      } else {
        continue;
      }

      // 重複チェック
      if (seen.has(pdfUrl)) continue;
      seen.add(pdfUrl);

      // リンクテキストから日付・種別を抽出
      // 例: "（9月6日初日） (PDFファイル: 346.2KB)"
      // 例: "（12月6日初日） (PDFファイル: 336.1KB)"
      const dateTypeMatch = rawText.match(/（(\d+)月(\d+)日([^）]*)）/);
      const month = dateTypeMatch?.[1] ? parseInt(dateTypeMatch[1], 10) : sessionMonth;
      const day = dateTypeMatch?.[2] ? parseInt(dateTypeMatch[2], 10) : null;
      const dayType = dateTypeMatch?.[3]?.trim() ?? "";

      // heldOn を組み立て（年・月・日が揃っている場合のみ）
      let heldOn: string | null = null;
      if (year && month && day) {
        const mm = String(month).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        heldOn = `${year}-${mm}-${dd}`;
      }

      // タイトルを組み立て
      const sessionLabel =
        sessionNumber !== null && sessionMonth !== null
          ? `第${sessionNumber}回（${sessionMonth}月）定例会`
          : h3Text;
      const dateLabel =
        month && day ? `${month}月${day}日` : "";
      const typeLabel = dayType || "";
      const title = [sessionLabel, dateLabel, typeLabel]
        .filter(Boolean)
        .join(" ");

      records.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
      });
    }
  }

  return records;
}

/**
 * 指定年の定例会 PDF リンク一覧を取得する。
 */
export async function fetchSessionList(
  year: number,
): Promise<KawaiSessionInfo[]> {
  // Step 1: インデックスページから年度別ページ URL を収集
  const indexHtml = await fetchPage(INDEX_URL);
  if (!indexHtml) return [];

  const yearPageUrls = parseYearPageUrls(indexHtml, year);
  if (yearPageUrls.length === 0) return [];

  const allRecords: KawaiSessionInfo[] = [];

  // Step 2: 各年度ページから PDF リンクを収集
  for (const url of yearPageUrls) {
    await delay(1000);
    const html = await fetchPage(url);
    if (!html) continue;

    const records = parseYearPage(html, year);
    allRecords.push(...records);
  }

  return allRecords;
}
