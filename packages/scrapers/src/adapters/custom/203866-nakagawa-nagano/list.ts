/**
 * 中川村議会 — list フェーズ
 *
 * 2段階クロール:
 *   1. 一覧ページ (list30-185.html) から全定例会・臨時会の詳細ページ URL を収集
 *   2. 各詳細ページから開催日ごとの PDF リンクを収集
 *
 * 一覧ページ構造:
 *   各エントリは定例会/臨時会名（例: 「令和7年9月定例会」）と
 *   詳細ページへのリンク (/site/gikai/{ID}.html) で構成される
 *
 * 詳細ページ構造:
 *   開催日ラベル（例: 「令和7年9月8日」）と PDF リンクが対になって並ぶ
 *   PDF URL 形式: /uploaded/attachment/{添付ID}.pdf
 */

import { BASE_ORIGIN, eraToWesternYear, fetchPage, LIST_URL } from "./shared";

export interface NakagawaNaganoSession {
  /** 詳細ページ URL (e.g., https://www.vill.nakagawa.nagano.jp/site/gikai/12426.html) */
  detailUrl: string;
  /** 会議タイトル (e.g., "令和7年9月定例会") */
  sessionTitle: string;
  /** 西暦年（フィルタリング用） */
  year: number | null;
}

export interface NakagawaNaganoPdfRecord {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル (e.g., "令和7年9月定例会") */
  sessionTitle: string;
  /** 開催日ラベル (e.g., "令和7年9月8日") */
  heldOnLabel: string;
}

/**
 * 一覧ページの HTML から全定例会・臨時会の詳細ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * リンクパターン: href="/site/gikai/{ID}.html"
 * テキストパターン: "令和7年9月定例会" / "令和7年臨時会" など
 */
export function parseListPage(html: string): NakagawaNaganoSession[] {
  const results: NakagawaNaganoSession[] = [];
  const seen = new Set<string>();

  // /site/gikai/{数字}.html 形式のリンクを抽出
  const linkPattern =
    /<a[^>]+href="(\/site\/gikai\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const rawText = match[3]!.replace(/<[^>]+>/g, "").trim();

    // 全角数字を半角に正規化
    const title = rawText.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    );

    // 定例会 or 臨時会 を含むリンクのみを対象にする
    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    const detailUrl = `${BASE_ORIGIN}${href}`;

    // 重複スキップ
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    // 和暦年を西暦に変換
    const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
    let year: number | null = null;
    if (eraMatch) {
      year = eraToWesternYear(eraMatch[1]!, eraMatch[2]!);
    }

    results.push({ detailUrl, sessionTitle: rawText, year });
  }

  return results;
}

/**
 * 詳細ページの HTML から開催日ラベルと PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 詳細ページ構造:
 *   日付ラベルテキスト（例: "令和7年9月8日"）の直後に
 *   PDF リンク /uploaded/attachment/{ID}.pdf がある
 *
 * 想定 HTML パターン:
 *   <li>令和7年9月8日<a href="/uploaded/attachment/7695.pdf">...</a></li>
 *   または
 *   <a href="/uploaded/attachment/7695.pdf">令和7年9月8日</a>
 */
export function parseDetailPage(
  html: string,
  sessionTitle: string
): NakagawaNaganoPdfRecord[] {
  const results: NakagawaNaganoPdfRecord[] = [];

  // 日付ラベルを含むブロックを先に収集する方法を使用
  // まず全体の構造を把握: li や p タグ単位でブロックを分割
  const blockPattern =
    /<(?:li|p|div|tr|td)[^>]*>([\s\S]*?)<\/(?:li|p|div|tr|td)>/gi;

  for (const block of html.matchAll(blockPattern)) {
    const blockHtml = block[1]!;

    // PDF リンクが含まれないブロックはスキップ
    if (!blockHtml.includes("/uploaded/attachment/")) continue;

    // PDF URL を抽出
    const pdfMatch = blockHtml.match(/href="(\/uploaded\/attachment\/\d+\.pdf)"/);
    if (!pdfMatch) continue;

    const pdfUrl = `${BASE_ORIGIN}${pdfMatch[1]!}`;

    // 日付ラベルを抽出（和暦日付パターン）
    const plainText = blockHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const dateMatch = plainText.match(
      /(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/
    );
    const heldOnLabel = dateMatch ? dateMatch[0] : sessionTitle;

    results.push({ pdfUrl, sessionTitle, heldOnLabel });
  }

  // ブロック方法で取得できなかった場合のフォールバック
  // PDF リンクのアンカーテキスト自体が日付の場合
  if (results.length === 0) {
    const anchorPattern =
      /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const match of html.matchAll(anchorPattern)) {
      const href = match[1]!;
      const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();
      const pdfUrl = `${BASE_ORIGIN}${href}`;

      // アンカーテキストに日付が含まれるか確認
      const dateMatch = rawText.match(
        /(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/
      );
      const heldOnLabel = dateMatch ? dateMatch[0] : rawText || sessionTitle;

      results.push({ pdfUrl, sessionTitle, heldOnLabel });
    }
  }

  return results;
}

/**
 * heldOnLabel（和暦日付文字列）を YYYY-MM-DD 形式に変換する。
 * e.g., "令和7年9月8日" → "2025-09-08"
 * 変換できない場合は null を返す。
 */
export function parseHeldOn(heldOnLabel: string): string | null {
  // 全角数字を半角に正規化
  const normalized = heldOnLabel.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(
    /^(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/
  );
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  const month = String(Number(match[3])).padStart(2, "0");
  const day = String(Number(match[4])).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * 一覧ページと詳細ページを巡回して、指定年の PDF レコード一覧を取得する。
 */
export async function fetchDocumentList(
  year: number
): Promise<NakagawaNaganoPdfRecord[]> {
  const listHtml = await fetchPage(LIST_URL);
  if (!listHtml) return [];

  const sessions = parseListPage(listHtml);

  // 指定年のセッションのみに絞り込む
  const targetSessions = sessions.filter((s) => s.year === year);

  const results: NakagawaNaganoPdfRecord[] = [];

  for (const session of targetSessions) {
    const detailHtml = await fetchPage(session.detailUrl);
    if (!detailHtml) continue;

    const records = parseDetailPage(detailHtml, session.sessionTitle);
    results.push(...records);
  }

  return results;
}
