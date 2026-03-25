/**
 * 津和野町議会 会議録 — list フェーズ
 *
 * 取得フロー:
 * 1. 一覧ページ（単一ページ）を取得
 * 2. <h3> タグから年度を抽出
 * 3. <h6> タグから会議情報を抽出:
 *    - 単一日程: <h6><a href="...pdf">第N回...（PDF）</a></h6>
 *    - 複数日程: <h6><strong>第N回...定例会</strong></h6> の後に <p><a>...各日</a></p>
 * 4. 指定年に合致する会議のみを返す
 *
 * 実際のページ構造（津和野町サイトから確認）:
 *   単一日程会議:
 *     <h6><a href="...060214.pdf">第１回２月臨時会（PDF／273KB）</a></h6>
 *   複数日程会議:
 *     <h6><strong>第３回3月定例会</strong></h6>
 *     <p><a href="...060308.pdf">第１日目　令和６年３月８日（PDF／1247KB）</a></p>
 *     <p><a href="...060313.pdf">第２日目　令和６年３月13日（PDF／1126KB）</a></p>
 */

import {
  LIST_URL,
  fetchPage,
  toAbsoluteUrl,
  parseJapaneseDate,
  parseJapaneseYear,
} from "./shared";

export interface TsuwanoMeeting {
  /** 会議タイトル（例: 第３回3月定例会） */
  title: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF ファイル名（externalId 生成用） */
  filename: string;
  /** 年度（西暦） */
  year: number;
}

/**
 * テキストから「（PDF／...）」形式のサイズ表記を除去する。
 */
function stripPdfSuffix(text: string): string {
  return text.replace(/[（(]PDF[^）)]*[）)]/gi, "").trim();
}

/**
 * 一覧ページ HTML から全 PDF エントリを抽出する。
 *
 * 実際のページ構造に合わせて 2 パターンを処理する:
 * 1. h6 内に <a> を持つ単一日程会議
 * 2. h6 外に <p><a> を持つ複数日程会議
 *
 * 返り値: TsuwanoMeeting[]（heldOn は null の場合あり）
 */
export function parseListPage(html: string): TsuwanoMeeting[] {
  const results: TsuwanoMeeting[] = [];

  type RawEntry =
    | { tag: "h3"; text: string; index: number }
    | { tag: "h6"; text: string; hasPdf: true; href: string; pdfText: string; index: number }
    | { tag: "h6"; text: string; hasPdf: false; index: number }
    | { tag: "a"; href: string; text: string; index: number };

  const entries: RawEntry[] = [];

  // h3 タグを収集（年度）
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)) {
    const text = m[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    entries.push({ tag: "h3", text, index: m.index! });
  }

  // h6 タグを収集（会議情報）
  // h6 内に PDF リンクがある場合（単一日程）と、ない場合（複数日程ヘッダー）を分岐
  for (const m of html.matchAll(/<h6[^>]*>([\s\S]*?)<\/h6>/gi)) {
    const inner = m[1]!;
    const pdfLinkMatch = inner.match(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/i);
    if (pdfLinkMatch) {
      // 単一日程: h6 内に PDF リンクあり
      const href = pdfLinkMatch[1]!;
      const pdfText = pdfLinkMatch[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      // タイトルは PDF テキストから（PDF）サフィックスを除去したもの
      const text = stripPdfSuffix(pdfText);
      entries.push({ tag: "h6", text, hasPdf: true, href, pdfText, index: m.index! });
    } else {
      // 複数日程ヘッダー: h6 内にテキストのみ
      const text = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      entries.push({ tag: "h6", text, hasPdf: false, index: m.index! });
    }
  }

  // h6 の外にある PDF リンクを収集（複数日程の各日）
  // h6 内の PDF リンクは除外するため、h6 の位置範囲を記録する
  const h6Ranges: [number, number][] = [];
  for (const m of html.matchAll(/<h6[^>]*>[\s\S]*?<\/h6>/gi)) {
    h6Ranges.push([m.index!, m.index! + m[0].length]);
  }

  function isInsideH6(idx: number): boolean {
    return h6Ranges.some(([start, end]) => idx >= start && idx < end);
  }

  for (const m of html.matchAll(/<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (isInsideH6(m.index!)) continue;
    const href = m[1]!;
    const text = m[2]!.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    entries.push({ tag: "a", href, text, index: m.index! });
  }

  // 出現順にソート
  entries.sort((a, b) => a.index - b.index);

  // コンテキストを追跡しながら結果を構築
  let currentYear: number | null = null;
  let currentMeetingTitle: string | null = null;

  for (const entry of entries) {
    if (entry.tag === "h3") {
      currentYear = parseJapaneseYear(entry.text);
      currentMeetingTitle = null;
    } else if (entry.tag === "h6") {
      if (entry.hasPdf) {
        // 単一日程: h6 からそのまま会議エントリを生成
        if (currentYear === null) continue;
        const pdfUrl = toAbsoluteUrl(entry.href);
        const filename = entry.href.split("/").pop()?.replace(".pdf", "") ?? entry.href;
        const heldOn = parseJapaneseDate(entry.pdfText);
        results.push({
          title: entry.text,
          pdfUrl,
          heldOn,
          filename,
          year: currentYear,
        });
        currentMeetingTitle = null;
      } else {
        // 複数日程ヘッダー: 後続の <a> タグで使う会議名を設定
        currentMeetingTitle = entry.text;
      }
    } else if (entry.tag === "a") {
      // 複数日程の各日: 直前の h6（複数日程ヘッダー）の会議名を使う
      if (currentYear === null || !currentMeetingTitle) continue;

      const pdfUrl = toAbsoluteUrl(entry.href);
      const filename = entry.href.split("/").pop()?.replace(".pdf", "") ?? entry.href;

      // リンクテキストから開催日を抽出
      const heldOn = parseJapaneseDate(entry.text);

      // タイトルに日程番号を付加
      let title = currentMeetingTitle;
      if (entry.text.includes("日目")) {
        const dayMatch = entry.text.match(/第([0-9０-９]+)日目/);
        if (dayMatch) {
          // 全角数字を半角に変換
          const dayNum = dayMatch[1]!.replace(/[０-９]/g, (c) =>
            String.fromCharCode(c.charCodeAt(0) - 0xfee0)
          );
          title = `${currentMeetingTitle} 第${dayNum}日目`;
        }
      }

      results.push({
        title,
        pdfUrl,
        heldOn,
        filename,
        year: currentYear,
      });
    }
  }

  return results;
}

/**
 * 指定年の全会議録一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<TsuwanoMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);
  return all.filter((m) => m.year === year);
}
