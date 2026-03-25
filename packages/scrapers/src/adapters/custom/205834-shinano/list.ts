/**
 * 信濃町議会 — list フェーズ
 *
 * 2段階クロール:
 *   1. 議会トップページから年度別一覧ページ URL を収集
 *   2. 年度別一覧ページから一般質問会議録ファイル（PDF/DOC/DOCX）の URL を収集
 *
 * SHIRASAGI CMS の構造:
 *   - 年度別一覧ページは /docs/{ページID}.html
 *   - ファイルは /fs/{数字}/{数字}/.../_/{ファイル名} 形式
 *   - 見出し（h2/h3）でグルーピングされている
 */

import { BASE_ORIGIN, detectMeetingType, eraToWesternYear, fetchPage, toJapaneseEra } from "./shared";

export interface ShinanoFile {
  /** ファイルの絶対 URL */
  fileUrl: string;
  /** ファイル種別 */
  fileType: "pdf" | "doc" | "docx";
  /** 会議タイトル（見出し + リンクテキストから構成） */
  title: string;
  /** 西暦年（解析できない場合は null） */
  year: number | null;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議タイプ */
  meetingType: string;
  /** 回号（例: "第424回"、解析できない場合は null） */
  sessionNumber: string | null;
  /** 月（例: 12、解析できない場合は null） */
  month: number | null;
  /** 議員名（一般質問の場合、解析できない場合は null） */
  memberName: string | null;
}

/** スキップ対象のリンクテキストパターン（会議録以外のドキュメント） */
const SKIP_PATTERNS = [
  /あいさつ/,
  /日程/,
  /議案/,
  /通告書/,
  /審議結果/,
  /案件名/,
];

/**
 * 一般質問会議録のリンクテキストから議員名を抽出する。
 * パターン例: "1. 北村富貴夫議員" / "北村富貴夫議員" / "北村富貴夫"
 */
function extractMemberName(text: string): string | null {
  // "N. 氏名議員" パターン
  const numbered = text.match(/^\d+[．.、]\s*(.+?)(?:議員)?$/);
  if (numbered?.[1]) {
    return numbered[1].trim().replace(/議員$/, "").trim();
  }
  // "氏名議員" パターン
  const withTitle = text.match(/^(.+?)議員$/);
  if (withTitle?.[1]) {
    return withTitle[1].trim();
  }
  return text.trim() || null;
}

/**
 * 見出しテキストから回号・月を抽出する。
 * パターン例: "第424回12月会議" / "第424回 12月定例会" / "令和7年3月会議"
 */
function parseSessionHeading(heading: string): {
  sessionNumber: string | null;
  month: number | null;
} {
  // 全角数字を半角に正規化
  const normalized = heading.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const sessionMatch = normalized.match(/第(\d+)回/);
  const sessionNumber = sessionMatch ? `第${sessionMatch[1]}回` : null;

  const monthMatch = normalized.match(/(\d+)月/);
  const month = monthMatch ? parseInt(monthMatch[1]!, 10) : null;

  return { sessionNumber, month };
}

/**
 * タイトルと月から heldOn（YYYY-MM-DD）を生成する。
 * 具体的な日付は不明なため月の1日をデフォルトとする。
 */
function buildHeldOn(year: number | null, month: number | null): string | null {
  if (!year || !month) return null;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * 年度別一覧ページの HTML から一般質問会議録ファイルリンクを抽出する（純粋関数）。
 *
 * 実際のページ構造（SHIRASAGI CMS）:
 *   - h1 タグ: 会議セクション見出し（例: "第422回信濃町議会定例会 12月会議"）
 *   - table[caption=一般質問会議録]: 一般質問会議録リンクのテーブル
 *   - td > a[href*="/fs/"]: 個別議員のファイルリンク
 *
 * 戦略:
 *   1. h1 見出しで会議セクションのコンテキスト（回号・月）を管理
 *   2. caption が「一般質問会議録」のテーブルからリンクを収集
 */
export function parseYearPage(html: string, year: number | null): ShinanoFile[] {
  const results: ShinanoFile[] = [];

  interface H1Entry {
    type: "h1";
    index: number;
    text: string;
  }
  interface TableEntry {
    type: "table";
    index: number;
    caption: string;
    tableHtml: string;
  }
  type Entry = H1Entry | TableEntry;

  const entries: Entry[] = [];

  // h1 見出しを収集
  const h1Pattern = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  for (const m of html.matchAll(h1Pattern)) {
    const text = m[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    entries.push({ type: "h1", index: m.index!, text });
  }

  // table を収集（caption 付き）
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  for (const m of html.matchAll(tablePattern)) {
    const tableHtml = m[0]!;
    const captionMatch = tableHtml.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
    if (captionMatch) {
      const caption = captionMatch[1]!.replace(/<[^>]+>/g, "").trim();
      entries.push({ type: "table", index: m.index!, caption, tableHtml });
    }
  }

  // 出現順にソート
  entries.sort((a, b) => a.index - b.index);

  let sessionNumber: string | null = null;
  let month: number | null = null;
  let currentH1Text = "";
  let currentMeetingType = "plenary";

  for (const entry of entries) {
    if (entry.type === "h1") {
      const normalized = entry.text.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      );
      const parsed = parseSessionHeading(normalized);
      // 回号か月が含まれる場合のみコンテキストを更新
      if (parsed.sessionNumber !== null || parsed.month !== null) {
        sessionNumber = parsed.sessionNumber;
        month = parsed.month;
        currentH1Text = entry.text;
        currentMeetingType = detectMeetingType(normalized);
      }
      continue;
    }

    // table エントリー処理
    if (entry.type !== "table") continue;
    if (!entry.caption.includes("一般質問会議録")) continue;

    // table 内の /fs/ リンクを収集
    const linkPattern = /<a[^>]+href="(\/fs\/[^"]+\.(pdf|doc|docx))"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const lm of entry.tableHtml.matchAll(linkPattern)) {
      const href = lm[1]!;
      const linkText = lm[3]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      // スキップ対象パターンをチェック
      if (SKIP_PATTERNS.some((p) => p.test(linkText))) continue;

      // ファイル種別を判定
      const lowerHref = href.toLowerCase();
      let fileType: "pdf" | "doc" | "docx";
      if (lowerHref.endsWith(".pdf")) {
        fileType = "pdf";
      } else if (lowerHref.endsWith(".docx")) {
        fileType = "docx";
      } else if (lowerHref.endsWith(".doc")) {
        fileType = "doc";
      } else {
        continue;
      }

      const fileUrl = `${BASE_ORIGIN}${href}`;
      const memberName = extractMemberName(linkText);
      const heldOn = buildHeldOn(year, month);

      // タイトルを構成
      const parts = [currentH1Text || "一般質問会議録"];
      if (memberName) parts.push(`${memberName}議員`);
      const title = parts.join(" ").trim();

      results.push({
        fileUrl,
        fileType,
        title,
        year,
        heldOn,
        meetingType: currentMeetingType,
        sessionNumber,
        month,
        memberName,
      });
    }
  }

  return results;
}

/**
 * 議会トップページの HTML から年度別一覧ページへのリンクを抽出する（純粋関数）。
 *
 * SHIRASAGI CMS のトップページには /docs/{数字}.html 形式のリンクが含まれる。
 * リンクテキストから年度（和暦）を判定する。
 */
export function parseTopPageLinks(html: string): Array<{ url: string; text: string }> {
  const results: Array<{ url: string; text: string }> = [];

  const linkPattern = /href="(\/docs\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(linkPattern)) {
    const href = m[1]!;
    const text = m[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    // 和暦を含むリンクのみ対象（全角数字も考慮）
    if (/(令和|平成)(元|[\d０-９]+)年/.test(text)) {
      results.push({ url: `${BASE_ORIGIN}${href}`, text });
    }
  }

  // 重複を除去（同じURLが複数回登場する場合）
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

/**
 * トップページリンクから指定年に対応する年度ページ URL を特定する。
 */
export function findYearPageUrls(
  links: Array<{ url: string; text: string }>,
  year: number
): string[] {
  const eraTexts = toJapaneseEra(year);
  return links
    .filter((link) => {
      const normalized = link.text.replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      );
      return eraTexts.some((era) => normalized.includes(era));
    })
    .map((link) => link.url);
}

/**
 * 年度別一覧ページの HTML から年を抽出する。
 * ページ内の和暦テキストから西暦を推定。
 */
function extractYearFromPageHtml(html: string): number | null {
  const match = html.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 指定年の一般質問会議録ファイルリストを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<ShinanoFile[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const links = parseTopPageLinks(topHtml);
  const yearPageUrls = findYearPageUrls(links, year);

  const allFiles: ShinanoFile[] = [];

  for (const pageUrl of yearPageUrls) {
    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) continue;

    // ページ内の和暦から年を再確認（複数年度が混在する場合の保険）
    const pageYear = extractYearFromPageHtml(pageHtml) ?? year;

    const files = parseYearPage(pageHtml, pageYear);
    allFiles.push(...files);
  }

  return allFiles;
}
