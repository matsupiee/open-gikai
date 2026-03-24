/**
 * 奥多摩町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. index.tree.json API から年度別ページの URL を取得
 * 2. 各年度別ページの HTML から会議名・会期・ファイル URL を抽出
 *
 * ファイル形式:
 *   - 令和2年以降: PDF (a.pdf)
 *   - 平成22〜31年頃: Word (.doc, a.word) — スキップ（テキスト抽出非対応）
 *
 * 「会議記録(一般質問(結果))」ページ（page_no: 1285）は除外する。
 */

import {
  TREE_JSON_URL,
  fetchPage,
  eraToWestern,
  normalizeUrl,
  normalizeFullWidth,
  detectMeetingType,
} from "./shared";

export interface OkutamaMeeting {
  /** PDF ファイルの完全 URL */
  pdfUrl: string;
  /** タイトル（例: "第1回定例会 本会議1日目"） */
  title: string;
  /** 開催日（YYYY-MM-DD 形式）。解析できない場合は null */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
}

/**
 * index.tree.json のエントリ型。
 */
interface TreeEntry {
  page_no: number | string;
  page_name: string;
  url?: string;
}

/**
 * index.tree.json API から年度別ページ一覧を取得する。
 * 「一般質問(結果)」ページ（page_no: 1285）は除外する。
 */
export function parseTreeJson(json: unknown): { pageNo: number; pageName: string; url: string }[] {
  if (!Array.isArray(json)) return [];

  const results: { pageNo: number; pageName: string; url: string }[] = [];
  for (const entry of json as TreeEntry[]) {
    const pageNo = typeof entry.page_no === "string" ? parseInt(entry.page_no, 10) : entry.page_no;
    // 一般質問（結果）ページは除外
    if (pageNo === 1285) continue;

    const pageName = (entry.page_name ?? "").trim();
    if (!pageName) continue;

    // ページ番号から URL を組み立てる
    const url = `https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/${pageNo}.html`;
    results.push({ pageNo, pageName, url });
  }
  return results;
}

/**
 * ページ名（例: "令和6年度"）から西暦年を抽出する。
 * 解析できない場合は null を返す。
 */
export function parsePageYear(pageName: string): number | null {
  const normalized = normalizeFullWidth(pageName);
  const match = normalized.match(/(令和|平成|昭和)(元|\d+)年/);
  if (!match) return null;
  return eraToWestern(match[1]!, match[2]!);
}

/**
 * 会期テキスト（例: "令和6年3月1日～3月15日"）から開始日（YYYY-MM-DD）を抽出する。
 * 解析できない場合は null を返す。
 */
export function parsePeriodDate(periodText: string): string | null {
  const normalized = normalizeFullWidth(periodText);

  // パターン: 令和/平成N年M月D日～ または 令和/平成N年M月D日〜
  const match = normalized.match(
    /(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/,
  );
  if (!match) return null;

  const year = eraToWestern(match[1]!, match[2]!);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別ページの HTML から会議情報と PDF リンクを抽出する。
 *
 * HTML 構造:
 *   <h2>第1回定例会</h2>
 *   <h3>令和6年3月1日～3月15日</h3>
 *   <p class="file-link-item"><a class="pdf" href="//...">本会議1日目 (PDFファイル: ...)</a></p>
 */
export function parseYearPage(html: string): OkutamaMeeting[] {
  const results: OkutamaMeeting[] = [];

  // h2 → 会議種別, h3 → 会期, p.file-link-item a → ファイル
  // シンプルな行ベースのパースを行う
  let currentMeetingType = "";
  let currentHeldOn: string | null = null;

  // h2 タグを抽出
  const h2Pattern = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  const h3Pattern = /<h3[^>]*>[\s\S]*?<\/h3>/gi;
  const fileLinkPattern = /<p[^>]*class="file-link-item"[^>]*>([\s\S]*?)<\/p>/gi;

  // セクションを解析するため、h2/h3/file-link-item の順序を維持してパースする
  // タグの出現位置を収集し、順番に処理する
  type Section =
    | { type: "h2"; pos: number; text: string }
    | { type: "h3"; pos: number; text: string }
    | { type: "file"; pos: number; href: string; linkText: string; fileType: "pdf" | "word" };

  const sections: Section[] = [];

  let m: RegExpExecArray | null;

  // h2 を収集
  while ((m = h2Pattern.exec(html)) !== null) {
    const text = stripTags(m[0]).trim();
    if (text) sections.push({ type: "h2", pos: m.index, text });
  }

  // h3 を収集
  while ((m = h3Pattern.exec(html)) !== null) {
    const text = stripTags(m[0]).trim();
    if (text) sections.push({ type: "h3", pos: m.index, text });
  }

  // file-link-item を収集
  while ((m = fileLinkPattern.exec(html)) !== null) {
    const inner = m[1] ?? "";
    // PDF または Word リンクを抽出
    const linkMatch = inner.match(/<a[^>]+class="(pdf|word)"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const fileType = (linkMatch[1]?.toLowerCase() ?? "pdf") as "pdf" | "word";
    const href = linkMatch[2] ?? "";
    const linkText = stripTags(linkMatch[3] ?? "").replace(/\s*\(.*?\)\s*$/, "").trim();
    sections.push({ type: "file", pos: m.index, href, linkText, fileType });
  }

  // 位置順にソート
  sections.sort((a, b) => a.pos - b.pos);

  for (const section of sections) {
    if (section.type === "h2") {
      currentMeetingType = section.text;
      currentHeldOn = null;
    } else if (section.type === "h3") {
      currentHeldOn = parsePeriodDate(section.text);
    } else if (section.type === "file") {
      // Word ファイル（.doc）はスキップ
      if (section.fileType === "word") continue;

      const absoluteUrl = normalizeUrl(section.href);
      const title = currentMeetingType
        ? `${currentMeetingType} ${section.linkText}`.trim()
        : section.linkText;

      results.push({
        pdfUrl: absoluteUrl,
        title,
        heldOn: currentHeldOn,
        meetingType: detectMeetingType(title || currentMeetingType),
      });
    }
  }

  return results;
}

/**
 * HTML タグを除去してプレーンテキストを返す。
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  _baseUrl: string,
  year: number,
): Promise<OkutamaMeeting[]> {
  // Step 1: index.tree.json から年度別ページ一覧を取得
  const treeText = await fetchPage(TREE_JSON_URL);
  if (!treeText) return [];

  let treeJson: unknown;
  try {
    treeJson = JSON.parse(treeText);
  } catch {
    console.warn("[133086-okutama] Failed to parse index.tree.json");
    return [];
  }

  const yearPages = parseTreeJson(treeJson);

  // 指定年に対応するページを検索
  const targetPages = yearPages.filter((p) => parsePageYear(p.pageName) === year);
  if (targetPages.length === 0) return [];

  // Step 2: 各年度ページから PDF リンクを収集
  const allMeetings: OkutamaMeeting[] = [];
  for (const page of targetPages) {
    const html = await fetchPage(page.url);
    if (!html) continue;
    allMeetings.push(...parseYearPage(html));
  }

  return allMeetings;
}
