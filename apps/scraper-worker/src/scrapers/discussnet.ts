/**
 * DiscussNet スクレイパー（NTT-AT / 会議録研究所）
 *
 * DiscussNet は全国最多導入の議会会議録検索システム。
 * URL パターン・HTML 構造がベンダーで統一されており、
 * 1 本のアダプターで数百自治体をカバーできる。
 *
 * CFW 互換: fetch + cheerio のみ使用。Playwright 不使用。
 *
 * 参考 URL パターン:
 *   一覧: {baseUrl}/g07_kaigirokuichiran.asp?KAIGI_NEN={year}
 *   詳細: {baseUrl}/g07_kaigiroku.asp?KAIGI_KEY={key}
 */

import { load } from "cheerio";
import type { MeetingData } from "../utils/types";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/** 議事録一覧ページから個別議事録への URL リストを抽出する */
export function extractMeetingLinks(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const links: string[] = [];

  // DiscussNet の一覧ページは <table> の <td> 内の <a> タグに議事録リンクが並ぶ
  // href に g07_kaigiroku.asp を含むリンクを対象とする
  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    if (
      href.includes("g07_kaigiroku.asp") ||
      href.includes("kaigiroku") ||
      href.match(/\?.*KAIGI_KEY=/i)
    ) {
      try {
        links.push(new URL(href, baseUrl).toString());
      } catch {
        // 相対 URL 解決に失敗した場合はスキップ
      }
    }
  });

  return [...new Set(links)]; // 重複排除
}

/** 次ページリンクを検出する（ページネーション） */
export function detectNextPageUrl(html: string, baseUrl: string): string | null {
  const $ = load(html);

  // 「次へ」「次ページ」「>>」等のリンクを検索
  const nextPatterns = ["次へ", "次ページ", ">>", "＞＞", "next"];
  let nextUrl: string | null = null;

  $("a[href]").each((_i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr("href") ?? "";
    if (nextPatterns.some((p) => text.includes(p)) && href) {
      try {
        nextUrl = new URL(href, baseUrl).toString();
      } catch {
        // スキップ
      }
      return false; // $.each を break
    }
  });

  return nextUrl;
}

/** 一覧ページの URL を組み立てる */
export function buildListUrl(baseUrl: string, year?: number): string {
  const base = baseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/g07_kaigirokuichiran.asp`);
  if (year !== undefined) {
    url.searchParams.set("KAIGI_NEN", String(year));
  }
  return url.toString();
}

/**
 * DiscussNet 個別議事録ページをパースして MeetingData を返す。
 *
 * @param html      議事録詳細ページの HTML
 * @param url       取得元 URL（sourceUrl として保存）
 * @param municipalityName 自治体名（例: 鹿児島市）
 * @param prefecture       都道府県名（例: 鹿児島県）
 */
export function parseMeetingPage(
  html: string,
  url: string,
  municipalityName: string,
  prefecture: string
): MeetingData | null {
  const $ = load(html);

  // DiscussNet の議事録ページ共通パターン:
  // - タイトル: <title> タグ or ページ内の見出し
  // - 日付: "開催日" 等のラベル隣の <td>
  // - 全文: id="kaigiroku" や class="honbun" 等のブロック
  const title =
    $("title").text().trim() ||
    $("h1, h2").first().text().trim() ||
    "（タイトル不明）";

  // 日付の取得: 「開催日」「会議日」ラベルの隣セルから
  const heldOn = extractDate($);
  if (!heldOn) return null;

  // 会議種別: タイトルや本文から推定
  const meetingType = detectMeetingType(title);

  // 本文テキスト: 議事録の全文を含む要素
  const rawText = extractRawText($);
  if (!rawText) return null;

  // externalId: URL の KAIGI_KEY パラメーターを利用
  const kaigiKey = new URL(url).searchParams.get("KAIGI_KEY") ?? url;
  const externalId = `discussnet_${municipalityName}_${kaigiKey}`;

  return {
    title,
    meetingType,
    heldOn,
    sourceUrl: url,
    assemblyLevel: "municipal",
    prefecture,
    municipality: municipalityName,
    externalId,
    rawText,
  };
}

// --- 内部ユーティリティ ---

/** 全角数字を半角に正規化する */
function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

function extractDate($: ReturnType<typeof load>): string | null {
  // DiscussNet 系に多いパターン: 「開催日」「会議日」の隣 <td>
  let dateStr: string | null = null;

  $("td, th").each((_i, el) => {
    const text = $(el).text().trim();
    if (text.match(/開催日|会議日|日\s*時/)) {
      // 次の兄弟 <td> を取得
      const next = $(el).next("td");
      if (next.length) {
        dateStr = normalizeFullWidth(next.text().trim());
        return false; // break
      }
    }
  });

  if (!dateStr) {
    // フォールバック: ページ内の日付パターンを正規表現で検索（全角数字も考慮）
    const bodyText = normalizeFullWidth($("body").text());
    const match = bodyText.match(
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/
    );
    if (match?.[1] && match[2] && match[3]) {
      dateStr = `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  if (!dateStr) return null;
  return normalizeDate(dateStr);
}

function normalizeDate(raw: string): string | null {
  const normalized = normalizeFullWidth(raw);

  // 和暦変換（令和・平成・昭和）
  const wareki: Record<string, number> = {
    令和: 2018,
    平成: 1988,
    昭和: 1925,
  };
  for (const [era, base] of Object.entries(wareki)) {
    const m = normalized.match(
      new RegExp(`${era}(\\d+)年(\\d{1,2})月(\\d{1,2})日`)
    );
    if (m?.[1] && m[2] && m[3]) {
      const y = base + Number(m[1]);
      return `${y}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
  }

  // 西暦
  const m = normalized.match(/(\d{4})[.\-\/年](\d{1,2})[.\-\/月](\d{1,2})/);
  if (m?.[1] && m[2] && m[3]) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  return null;
}

function detectMeetingType(title: string): string {
  // 委員会系を先に判定（「予算決算委員会」などが含まれるため）
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  // 本会議・定例会・議会はすべて plenary
  return "plenary";
}

function extractRawText($: ReturnType<typeof load>): string | null {
  // DiscussNet でよく使われる本文ブロックのセレクタ（優先順位順）
  // 研究調査結果: .kaigiroku-body が最も一般的なメインコンテナ
  const selectors = [
    ".kaigiroku-body",
    "#kaigiroku",
    ".honbun",
    "#honbun",
    ".kaigiroku",
    "#content",
    ".content",
    "table.kaigiroku",
  ];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length) {
      const text = el.html()?.trim();
      if (text && text.length > 100) return text;
    }
  }

  // フォールバック: body 全体（ヘッダー・フッターも含まれるが最後の手段）
  const bodyHtml = $("body").html()?.trim();
  return bodyHtml && bodyHtml.length > 100 ? bodyHtml : null;
}

/** fetch ラッパー（User-Agent 設定・エラーハンドリング） */
export async function fetchDiscussnet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    // DiscussNet は Shift-JIS を返すことがあるが、CF Workers の TextDecoder で対応
    const buffer = await res.arrayBuffer();
    // Content-Type から charset を判定
    const contentType = res.headers.get("content-type") ?? "";
    const charset = contentType.match(/charset=([^\s;]+)/i)?.[1] ?? "utf-8";
    const decoder = new TextDecoder(
      charset.toLowerCase().replace("shift_jis", "shift-jis")
    );
    return decoder.decode(buffer);
  } catch {
    return null;
  }
}
