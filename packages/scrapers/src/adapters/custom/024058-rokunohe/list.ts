/**
 * 六戸町議会 — list フェーズ
 *
 * 単一ページ https://www.town.rokunohe.aomori.jp/docs/2023051900005 に
 * 全会議録が年度別に掲載されている。
 *
 * - <h3> タグで年度区切り（「令和７年」「平成24年」等）
 * - 新形式（R6以降）: <p> タグ内の <a class="iconFile iconPdf"> で PDF リンク
 * - 旧形式（R5以前）: ネストされた <ul><li> 構造内の最初の <a> タグ
 */

import { fetchPage, resolveHref } from "./shared";

export interface RokunoheRecord {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
  section: string;
}

/**
 * 全角数字を半角数字に変換する。
 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * リンクテキストから会議名（本会議・委員会名）を抽出する。
 * e.g., "本会議3号（12月9日）[PDF：414KB]" → { meetingName: "本会議3号", heldOn: "2024-12-09" }
 */
export function parseLinkText(
  text: string,
  sectionYear: number,
): { meetingName: string; heldOn: string | null } {
  // テキストクリーニング（全角数字は月日抽出のために半角に変換）
  const clean = toHalfWidth(
    text.replace(/\[PDF[^\]]*\]/g, "").replace(/\(PDF[^)]*\)/g, "").trim(),
  );

  // 月日を抽出: （12月9日）や（12月9日、10日）など
  const dateMatch = clean.match(/[（(](\d+)月(\d+)日/);
  let heldOn: string | null = null;
  if (dateMatch) {
    const month = parseInt(dateMatch[1]!, 10);
    const day = parseInt(dateMatch[2]!, 10);
    heldOn = `${sectionYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 会議名: カッコの前まで（元テキストから取得してトリム）
  const nameMatch = text.replace(/\[PDF[^\]]*\]/g, "").trim().match(/^([^（(]+)/);
  const meetingName = nameMatch ? nameMatch[1]!.trim() : text.trim();

  return { meetingName, heldOn };
}

/**
 * <h3> タグのテキストから西暦年を抽出する。
 * e.g., "令和７年" → 2025, "平成24年" → 2012
 * 全角数字にも対応する。
 */
export function parseEraYear(text: string): number | null {
  // HTML タグを除去して全角数字を半角に変換
  const clean = toHalfWidth(text.replace(/<[^>]+>/g, "").trim());
  const match = clean.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * HTML 全体から指定年の会議録リンクを抽出する（純粋関数）。
 *
 * - <h3> で年度セクションを識別
 * - <li> の直接テキスト（定例会・臨時会名）を section として記録
 * - PDF リンクのみ収集（<img> を含むダミーリンクは除外）
 */
export function parsePage(html: string, targetYear: number): RokunoheRecord[] {
  const results: RokunoheRecord[] = [];

  // <div class="body"> 内を抽出（なければ全体を使う）
  const bodyMatch = html.match(/<div[^>]+class="body"[^>]*>([\s\S]*?)<\/div>/);
  const body = bodyMatch ? bodyMatch[1]! : html;

  // h3 タグで分割
  const sections = body.split(/(?=<h3[^>]*>)/i);

  for (const section of sections) {
    // h3 タグのテキストを取得
    const h3Match = section.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!h3Match) continue;

    const h3Text = h3Match[1]!;
    const sectionYear = parseEraYear(h3Text);
    if (sectionYear === null) continue;

    // 対象年かチェック（parseEraYear が全角数字を処理するため西暦で比較）
    if (sectionYear !== targetYear) continue;

    // このセクション内の全 PDF リンクを収集
    // <a> タグを抽出し、<img> を含まないもので .pdf で終わるリンクを取得
    const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

    // 直近の <li> テキスト（定例会・臨時会名）を追跡
    // セクションを行ごとに処理して section 情報を付与
    let currentSection = "";

    // li テキストを含めて処理
    const liPattern = /<li(?:\s[^>]*)?>[\s\S]*?(?=<li(?:\s[^>]*)?>|$)/gi;
    const liMatches = [...section.matchAll(liPattern)];

    if (liMatches.length > 0) {
      for (const liMatch of liMatches) {
        const liContent = liMatch[0]!;

        // li の直接テキスト（子 li の内容を除いた）を section 名として使う
        // まず子 ul を除去して直接テキストを取得
        const liTextOnly = liContent
          .replace(/<ul[\s\S]*?<\/ul>/gi, "")
          .replace(/<[^>]+>/g, "")
          .trim();

        // 定例会・臨時会名のパターン（第N回定例会など）
        if (liTextOnly && /第\d+回/.test(liTextOnly)) {
          currentSection = liTextOnly.replace(/\s+/g, " ").trim();
        }

        // この li 内の PDF リンクを抽出
        for (const match of liContent.matchAll(linkPattern)) {
          const href = match[1]!;
          const innerHtml = match[2]!;

          // .pdf で終わるリンクのみ
          if (!href.toLowerCase().endsWith(".pdf")) continue;

          // img を含むリンクはダミーの可能性があるためスキップ
          if (/<img/i.test(innerHtml)) continue;

          const linkText = innerHtml.replace(/<[^>]+>/g, "").trim();
          const { meetingName, heldOn } = parseLinkText(linkText, sectionYear);

          const pdfUrl = resolveHref(href);

          results.push({
            pdfUrl,
            title: meetingName,
            heldOn,
            section: currentSection,
          });
        }
      }
    } else {
      // li がない場合は p タグ内のリンクを直接探す（新形式）
      for (const match of section.matchAll(linkPattern)) {
        const href = match[1]!;
        const innerHtml = match[2]!;

        if (!href.toLowerCase().endsWith(".pdf")) continue;
        if (/<img/i.test(innerHtml)) continue;

        const linkText = innerHtml.replace(/<[^>]+>/g, "").trim();
        const { meetingName, heldOn } = parseLinkText(linkText, sectionYear);

        const pdfUrl = resolveHref(href);

        results.push({
          pdfUrl,
          title: meetingName,
          heldOn,
          section: currentSection,
        });
      }
    }
  }

  // li パターンで取れない新形式（p タグ直下）を補完するため
  // 別アプローチ: h3 セクションごとに全 a タグを走査
  if (results.length === 0) {
    return parsePageFallback(html, targetYear);
  }

  return results;
}

/**
 * フォールバック: シンプルなアプローチで全 PDF リンクを収集。
 * HTML を h3 タグで分割して、対象年セクションの全 <a href="*.pdf"> を取得。
 */
function parsePageFallback(
  html: string,
  targetYear: number,
): RokunoheRecord[] {
  const results: RokunoheRecord[] = [];

  // h3 タグで分割
  const sectionPattern = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|$)/gi;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const h3Content = sectionMatch[1]!;
    const sectionBody = sectionMatch[2]!;

    const sectionYear = parseEraYear(h3Content);
    if (sectionYear === null) continue;

    if (sectionYear !== targetYear) continue;

    // 直近の ul > li テキスト（定例会名）を追跡
    let currentSection = "";

    // ul > li の構造を解析
    // 最初の li テキストを section 名として使う
    const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
    for (const ulMatch of sectionBody.matchAll(ulPattern)) {
      const ulContent = ulMatch[0]!;

      // ul の直接の li（ネストされた ul より前）
      const outerLiPattern = /<li[^>]*>([\s\S]*?)(?=<\/li>)/gi;
      for (const liMatch of ulContent.matchAll(outerLiPattern)) {
        const liContent = liMatch[1]!;

        // 子 ul を除いたテキスト
        const textOnly = liContent
          .replace(/<ul[\s\S]*?<\/ul>/gi, "")
          .replace(/<[^>]+>/g, "")
          .trim();

        if (textOnly && /第\d+回/.test(textOnly)) {
          currentSection = textOnly.replace(/\s+/g, " ").trim();
        }

        // PDF リンクを収集
        const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
        for (const linkMatch of liContent.matchAll(linkPattern)) {
          const href = linkMatch[1]!;
          const innerHtml = linkMatch[2]!;

          // img を含む（ダミー）リンクをスキップ
          if (/<img/i.test(innerHtml)) continue;

          const linkText = innerHtml.replace(/<[^>]+>/g, "").trim();
          const { meetingName, heldOn } = parseLinkText(linkText, sectionYear);

          results.push({
            pdfUrl: resolveHref(href),
            title: meetingName,
            heldOn,
            section: currentSection,
          });
        }
      }
    }

    // p タグ内のリンク（新形式）
    const pLinkPattern = /<p[^>]*>[\s\S]*?<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/p>/gi;
    for (const pMatch of sectionBody.matchAll(pLinkPattern)) {
      const href = pMatch[1]!;
      const innerHtml = pMatch[2]!;

      if (/<img/i.test(innerHtml)) continue;

      const linkText = innerHtml.replace(/<[^>]+>/g, "").trim();
      const { meetingName, heldOn } = parseLinkText(linkText, sectionYear);

      results.push({
        pdfUrl: resolveHref(href),
        title: meetingName,
        heldOn,
        section: currentSection,
      });
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<RokunoheRecord[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parsePage(html, year);
}
