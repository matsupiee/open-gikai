/**
 * 隠岐の島町（島根県）議会 会議録 — list フェーズ
 *
 * 会議録一覧ページ（4407.html）を 1 回取得するだけで全年度・全会議の PDF リンクを収集できる。
 * h2 見出しごとに会議メタ情報を抽出し、直後の PDF リンクと対応づける。
 *
 * 一覧ページ構造:
 *   <h2>令和7年第3回(8月7日)臨時会会議録</h2>
 *   <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/0703rinnjikai.pdf">
 *     令和7年第3回臨時会 (PDFファイル: 189.4KB)
 *   </a>
 *
 *   <h2>令和7年第2回(6月)定例会会議録</h2>
 *   <a href="//www.town.okinoshima.shimane.jp/material/files/group/3/syoniti00702.pdf">
 *     第1日(初日) (PDFファイル: XXX.XKB)
 *   </a>
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  fetchPage,
  toHalfWidth,
} from "./shared";

export interface OkinoshimaMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（h2 見出し、例: "令和7年第2回(6月)定例会会議録"） */
  title: string;
  /** PDF リンクテキスト（例: "第1日(初日)"） */
  label: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（自治体コード + PDF ファイル名） */
  pdfKey: string;
}

/**
 * h2 見出しテキストから開催日を抽出する。
 * 例: "令和7年第2回(6月)定例会会議録" → 年は取れるが月日は不明 → null
 * 例: "令和7年第3回(8月7日)臨時会会議録" → "2025-08-07"
 */
export function parseDateFromHeading(heading: string): string | null {
  const half = toHalfWidth(heading);

  // パターン: (M月D日) を持つ見出し
  const fullDateMatch = half.match(
    /(令和|平成)(元|\d+)年第\d+回\((\d+)月(\d+)日\)/,
  );
  if (fullDateMatch) {
    const eraYear =
      fullDateMatch[2] === "元" ? 1 : parseInt(fullDateMatch[2]!, 10);
    const month = parseInt(fullDateMatch[3]!, 10);
    const day = parseInt(fullDateMatch[4]!, 10);
    const era = fullDateMatch[1]!;
    const westernYear = era === "令和" ? eraYear + 2018 : eraYear + 1988;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 会議録一覧ページの HTML から h2 見出しと PDF リンクを対応づけて抽出する（純粋関数）。
 *
 * HTML 構造:
 *   <h2>会議タイトル</h2>
 *   <a href="//...pdf">PDF リンクテキスト</a>  (1 つ以上)
 *   <h2>次の会議タイトル</h2>
 *   ...
 */
export function parseListPage(html: string, targetYear?: number): OkinoshimaMeeting[] {
  const meetings: OkinoshimaMeeting[] = [];

  // h2 タグと a タグ（PDF リンク）を逐次解析
  // h2 を検出したら現在のタイトルとして保持し、直後の a[href$=".pdf"] を紐づける
  const tokenPattern =
    /<h2[^>]*>([\s\S]*?)<\/h2>|<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  let currentTitle = "";
  let currentHeldOn: string | null = null;
  let currentCategory = "plenary";
  let currentYear: number | null = null;

  for (const match of html.matchAll(tokenPattern)) {
    const h2Content = match[1];
    const pdfHref = match[2];
    const linkText = match[3];

    if (h2Content !== undefined) {
      // h2 検出: 現在のタイトルを更新
      const rawTitle = h2Content.replace(/<[^>]+>/g, "").trim();
      currentTitle = rawTitle;
      currentHeldOn = parseDateFromHeading(rawTitle);
      currentCategory = rawTitle.includes("臨時会") ? "extraordinary" : "plenary";

      // 年を抽出
      const half = toHalfWidth(rawTitle);
      const eraMatch = half.match(/(令和|平成)(元|\d+)年/);
      if (eraMatch) {
        const eraYear = eraMatch[2] === "元" ? 1 : parseInt(eraMatch[2]!, 10);
        const era = eraMatch[1]!;
        currentYear = era === "令和" ? eraYear + 2018 : eraYear + 1988;
      } else {
        currentYear = null;
      }
    } else if (pdfHref !== undefined && linkText !== undefined && currentTitle) {
      // targetYear フィルタリング
      if (targetYear !== undefined && currentYear !== null && currentYear !== targetYear) {
        continue;
      }

      // プロトコル相対 URL を https: 補完
      const rawHref = pdfHref.startsWith("//")
        ? `https:${pdfHref}`
        : pdfHref.startsWith("http")
          ? pdfHref
          : new URL(pdfHref, BASE_ORIGIN).toString();

      const fileName =
        rawHref.split("/").pop()?.replace(".pdf", "") ?? rawHref;
      const pdfKey = `325287_${fileName}`;

      const label = linkText.replace(/<[^>]+>/g, "").trim();

      meetings.push({
        pdfUrl: rawHref,
        title: currentTitle,
        label,
        heldOn: currentHeldOn,
        category: currentCategory,
        pdfKey,
      });
    }
  }

  return meetings;
}

/**
 * 指定年の会議一覧を取得する。
 *
 * 1. 会議録一覧ページ（4407.html）を 1 回取得
 * 2. 指定年に対応する h2 見出し以下の PDF リンクを収集
 */
export async function fetchDocumentList(
  year: number,
): Promise<OkinoshimaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html, year);
}
