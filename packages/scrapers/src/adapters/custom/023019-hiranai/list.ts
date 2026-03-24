/**
 * 平内町議会 — list フェーズ
 *
 * 単一の会議録一覧ページ (594.html) から全 PDF リンクを収集する。
 *
 * 構造:
 *   - 年度ごとに見出し（令和N年）で区切られ、各定例会の PDF リンクが並ぶ
 *   - ページネーションなし（全リンクが単一ページに存在）
 *   - PDF リンクは `//www.town.hiranai.aomori.jp/...` 形式（プロトコル相対 URL）
 */

import { BASE_ORIGIN, eraToWestern, fetchPage } from "./shared";

export interface HiranaiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年第1回定例会"） */
  title: string;
  /** 西暦年（例: 2024） */
  year: number;
  /** 開催月（1-12, リンクテキストから取得。不明の場合は null） */
  month: number | null;
}

/**
 * 会議録一覧ページ HTML から PDF リンク一覧をパースする（テスト可能な純粋関数）。
 *
 * アルゴリズム:
 *   1. 年度見出し（令和N年）を検出して現在の年度を更新
 *   2. PDF リンク（href が .pdf で終わる）を収集
 *   3. リンクテキストから回次と月を抽出（例: "第2回（6月）"）
 */
export function parseListPage(html: string): HiranaiMeeting[] {
  const meetings: HiranaiMeeting[] = [];

  // HTML タグと属性を除去した後のテキスト部分を走査するのではなく、
  // セクション構造（見出し → PDF リンク）を解析する。

  // 年度見出し（h2, h3, h4, dt, strong など）と PDF リンクを一緒に処理するため、
  // タグを順番に処理していく。
  let currentYear: number | null = null;

  // ブロック要素を順番に処理するシンプルなアプローチ:
  // - 見出し系要素（h2〜h5、dt、strong を含む行）から年度を抽出
  // - <a href="...pdf"> から PDF リンクを抽出
  // HTML を行単位で分割して処理する
  const lines = html.split(/\n/);

  for (const line of lines) {
    // 見出しから年度を抽出
    // 例: <h3 class="heading-lv3">令和7年（2025年）</h3>
    //     <dt>令和6年</dt>
    if (/<h[2-5]|<dt\b|<strong\b/i.test(line)) {
      const eraMatch = line.match(/(令和|平成)(元|\d+)年/);
      if (eraMatch) {
        const year = eraToWestern(eraMatch[1]!, eraMatch[2]!);
        if (year) currentYear = year;
      }
    }

    if (currentYear === null) continue;

    // PDF リンクを抽出
    // href がプロトコル相対（// で始まる）または絶対 URL で .pdf で終わる場合を処理
    const pdfLinkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const match of line.matchAll(pdfLinkRegex)) {
      const href = match[1]!;
      const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

      // 完全 URL を構築
      let pdfUrl: string;
      if (href.startsWith("//")) {
        pdfUrl = `https:${href}`;
      } else if (href.startsWith("http")) {
        pdfUrl = href;
      } else if (href.startsWith("/")) {
        pdfUrl = `${BASE_ORIGIN}${href}`;
      } else {
        pdfUrl = `${BASE_ORIGIN}/${href}`;
      }

      // リンクテキストから回次と月を抽出
      // パターン例: "第1回（3月）", "第2回（6月）", "第1回"
      const meetingPattern = /第(\d+)回[（(](\d+)月[)）]/;
      const meetingMatch = rawText.match(meetingPattern);

      let sessionNum: number | null = null;
      let month: number | null = null;

      if (meetingMatch) {
        sessionNum = Number(meetingMatch[1]);
        month = Number(meetingMatch[2]);
      } else {
        // 月なしパターン: "第1回", "第N回"
        const numOnlyMatch = rawText.match(/第(\d+)回/);
        if (numOnlyMatch) {
          sessionNum = Number(numOnlyMatch[1]);
        }
      }

      const sessionLabel =
        sessionNum !== null ? `第${sessionNum}回定例会` : rawText || "定例会";
      const title = `令和${currentYear - 2018}年${sessionLabel}`;

      meetings.push({
        pdfUrl,
        title,
        year: currentYear,
        month,
      });
    }
  }

  return meetings;
}

/**
 * 指定年の PDF リンク一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HiranaiMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  const all = parseListPage(html);
  return all.filter((m) => m.year === year);
}
