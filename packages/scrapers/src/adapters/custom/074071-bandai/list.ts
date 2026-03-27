/**
 * 磐梯町議会 会議録 — list フェーズ
 *
 * 一覧ページ構造:
 *   - <h2> 令和7年定例会 </h2>
 *   - 直後の <ul> 内に BackShelf 公開リンク
 */

import {
  detectMeetingType,
  fetchPage,
  LIST_URL,
  parseWarekiYear,
} from "./shared"

export interface BandaiMeeting {
  title: string
  openUrl: string
  year: number
  meetingType: "plenary" | "committee" | "extraordinary"
}

function normalizeText(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
}

/**
 * 一覧ページ HTML から会議レコードを抽出する。
 */
export function parseListPage(html: string): BandaiMeeting[] {
  const records: BandaiMeeting[] = []
  const seen = new Set<string>()

  const tokenRegex = /<h2[^>]*>([\s\S]*?)<\/h2>|<a[^>]+href="([^"]*open\.backshelf\.jp\/\?[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi

  let currentYear: number | null = null
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(html)) !== null) {
    const headingHtml = match[1]
    const href = match[2]
    const titleHtml = match[3]

    if (headingHtml) {
      currentYear = parseWarekiYear(normalizeText(headingHtml))
      continue
    }

    if (!href || !titleHtml) continue

    const title = normalizeText(titleHtml)
    if (!title.includes("会議録")) continue
    if (seen.has(href)) continue

    const year = parseWarekiYear(title) ?? currentYear
    if (!year) continue

    seen.add(href)
    records.push({
      title,
      openUrl: href,
      year,
      meetingType: detectMeetingType(title),
    })
  }

  return records
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(year: number): Promise<BandaiMeeting[]> {
  const result = await fetchPage(LIST_URL)
  if (!result) return []

  return parseListPage(result.html).filter((record) => record.year === year)
}

