import {
  buildDocumentUrl,
  buildListUrl,
  convertWarekiToWesternYear,
  detectMeetingType,
  fetchPage,
  parseJapaneseDate,
  toHalfWidth,
} from "./shared";

export interface HigashikushiraMeeting {
  title: string;
  pdfUrl: string;
  heldOn: string | null;
  meetingType: string;
  headingYear: number;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(html: string): string {
  return decodeEntities(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * 一覧ページ HTML から年度別の PDF リンクを抽出する。
 *
 * 例:
 *   <p>令和6年</p>
 *   <table>
 *     <tr>
 *       <td>第1回定例会<a href="file_contents/060711.pdf">[PDF:...]</a></td>
 *       <td>令和6年3月7日(木)～令和6年3月18日(月)</td>
 *     </tr>
 *   </table>
 */
export function parseListPage(html: string, baseUrl?: string): HigashikushiraMeeting[] {
  const results: HigashikushiraMeeting[] = [];
  const yearHeadings: Array<{ year: number; position: number }> = [];

  const headingPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingPattern.exec(html)) !== null) {
    const text = stripTags(headingMatch[1]!);
    if (!/^(令和|平成)(元|[0-9０-９]+)年[　\s]*$/.test(text)) continue;
    const year = convertWarekiToWesternYear(text);
    if (year !== null) {
      yearHeadings.push({ year, position: headingMatch.index });
    }
  }

  for (let index = 0; index < yearHeadings.length; index++) {
    const start = yearHeadings[index]!.position;
    const end =
      index + 1 < yearHeadings.length
        ? yearHeadings[index + 1]!.position
        : html.length;
    const section = html.slice(start, end);
    const tableMatch = section.match(/<table[\s\S]*?<\/table>/i);
    if (!tableMatch) continue;

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowPattern.exec(tableMatch[0])) !== null) {
      const cellMatches = [...rowMatch[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (cellMatches.length < 2) continue;

      const titleCell = cellMatches[0]![1]!;
      const dateCell = cellMatches[1]![1]!;
      const hrefMatch = titleCell.match(/href="([^"]+\.pdf)"/i);
      if (!hrefMatch) continue;

      const title = toHalfWidth(
        stripTags(titleCell).replace(/\[PDF：?[^\]]+\]/gi, "").trim(),
      );
      if (!title || title === "会議名") continue;

      const combinedText = `${stripTags(titleCell)} ${stripTags(dateCell)}`;
      results.push({
        title,
        pdfUrl: buildDocumentUrl(hrefMatch[1]!, baseUrl),
        heldOn: parseJapaneseDate(combinedText),
        meetingType: detectMeetingType(title),
        headingYear: yearHeadings[index]!.year,
      });
    }
  }

  return results;
}

/** 指定年の会議一覧を取得する */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HigashikushiraMeeting[]> {
  const listUrl = buildListUrl(baseUrl);
  const html = await fetchPage(listUrl);
  if (!html) {
    console.warn(`[464821-higashikushira] Failed to fetch list page: ${listUrl}`);
    return [];
  }

  return parseListPage(html, listUrl).filter((meeting) => meeting.headingYear === year);
}
