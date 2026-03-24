/**
 * 蓬田村議会 — list フェーズ
 *
 * gijiroku.html から全 PDF リンクを収集する。
 * 年度ごとに <h2> で区切られ、各 <a href="*.pdf"> が会議録 PDF を指す。
 */

import { LIST_URL, BASE_URL, fetchPage, parseEraYear, toHalfWidth } from "./shared";

export interface YomogitaMeeting {
  /** 会議タイトル（例: "令和７年第４回蓬田村議会定例会会議録（第１号）"） */
  title: string;
  /** 開催年（西暦） */
  year: number;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の完全 URL */
  pdfUrl: string;
}

/**
 * 定例会タイトルから開催日（YYYY-MM-DD）を推測する。
 *
 * ファイル名に MMDD が含まれる場合はそこから推測する。
 * e.g., "r07-04t-01-1203.pdf" → 12月3日
 *
 * 解析できない場合は null を返す。
 */
export function parseDateFromFilename(filename: string, year: number): string | null {
  // パターン: MMDD (4桁) がファイル名末尾にある場合
  // e.g., r07-04t-01-1203.pdf → 1203 → 12月3日
  // e.g., r06-04t-01-1204.pdf → 1204 → 12月4日
  const mmddMatch = filename.match(/-(\d{4})\.pdf$/i);
  if (mmddMatch?.[1]) {
    const mmdd = mmddMatch[1];
    const month = parseInt(mmdd.slice(0, 2), 10);
    const day = parseInt(mmdd.slice(2, 4), 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // パターン: YYYYMMDD がファイル名に含まれる場合
  // e.g., giji_kessan1_20230905.pdf
  const yyyymmddMatch = filename.match(/(\d{8})\.pdf$/i);
  if (yyyymmddMatch?.[1]) {
    const dateStr = yyyymmddMatch[1];
    const y = parseInt(dateStr.slice(0, 4), 10);
    const m = parseInt(dateStr.slice(4, 6), 10);
    const d = parseInt(dateStr.slice(6, 8), 10);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * リンクテキストから定例会の回数・号数を抽出する。
 *
 * 定例会: "令和X年第Y回蓬田村議会定例会会議録（第Z号）"
 * 特別委員会: "予算特別委員会会議録（第Z号）" / "決算特別委員会会議録（第Z号）"
 *
 * 解析できない場合は null を返す。
 */
export function parseMeetingInfo(
  text: string,
): { sessionNum: number | null; issueNum: number | null; committeeType: string | null } | null {
  const normalized = toHalfWidth(text.trim());

  // 定例会パターン
  const teireiMatch = normalized.match(/第(\d+)回蓬田村議会定例会会議録[（(]第(\d+)号[）)]/);
  if (teireiMatch) {
    return {
      sessionNum: parseInt(teireiMatch[1]!, 10),
      issueNum: parseInt(teireiMatch[2]!, 10),
      committeeType: null,
    };
  }

  // 特別委員会パターン（予算・決算）
  const tokubetsuMatch = normalized.match(/(予算|決算)特別委員会会議録[（(]第(\d+)号[）)]/);
  if (tokubetsuMatch) {
    return {
      sessionNum: null,
      issueNum: parseInt(tokubetsuMatch[2]!, 10),
      committeeType: tokubetsuMatch[1]!,
    };
  }

  return null;
}

/**
 * gijiroku.html の HTML から会議録一覧をパースする。
 *
 * - <h2> タグで年度を区切る
 * - <a href="*.pdf"> から PDF リンクとタイトルを収集
 */
export function parseListPage(html: string): YomogitaMeeting[] {
  const meetings: YomogitaMeeting[] = [];

  // <h2> で区切られたブロックごとに処理
  // h2 の後に続く全コンテンツ（次の h2 まで）を取得
  const blocks: { yearText: string; content: string }[] = [];

  // h2 タグの位置を全て検索
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h2Matches = [...html.matchAll(h2Regex)];

  for (let i = 0; i < h2Matches.length; i++) {
    const match = h2Matches[i]!;
    const yearText = match[1]!.replace(/<[^>]+>/g, "").trim();

    // 年度テキストでなければスキップ（「令和」「平成」を含むもの）
    if (!yearText.includes("令和") && !yearText.includes("平成")) continue;

    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx =
      i + 1 < h2Matches.length
        ? h2Matches[i + 1]!.index ?? html.length
        : html.length;

    blocks.push({
      yearText,
      content: html.slice(startIdx, endIdx),
    });
  }

  for (const block of blocks) {
    const year = parseEraYear(block.yearText);
    if (!year) continue;

    // PDF リンクを収集
    const pdfLinkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of block.content.matchAll(pdfLinkRegex)) {
      const href = linkMatch[1]!;
      const rawTitle = (linkMatch[2] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .replace(/\(\d+KB\)/gi, "")
        .trim();

      if (!rawTitle) continue;

      // 絶対 URL を構築
      const pdfUrl = href.startsWith("http")
        ? href
        : `${BASE_URL}/${href.replace(/^\//, "")}`;

      // ファイル名から日付を推測
      const filename = pdfUrl.split("/").pop() ?? "";
      const heldOn = parseDateFromFilename(filename, year);

      meetings.push({
        title: rawTitle,
        year,
        heldOn,
        pdfUrl,
      });
    }
  }

  return meetings;
}

/**
 * gijiroku.html を取得し、会議録一覧を返す。
 * year を指定した場合は該当年のみ返す。
 */
export async function fetchMeetingList(year?: number): Promise<YomogitaMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  const all = parseListPage(html);

  if (year !== undefined) {
    return all.filter((m) => m.year === year);
  }

  return all;
}
