/**
 * 磐梯町議会 会議録 — detail フェーズ
 *
 * BackShelf の公開リンクを解決し、viewer のテキスト表示 API から全ページ本文を取得して
 * 発言単位に分割する。
 */

import { createHash } from "node:crypto"
import type { MeetingData, ParsedStatement } from "../../../utils/types"
import { buildCookieHeader, detectMeetingType, fetchPage, toHalfWidth } from "./shared"

export interface BandaiDetailParams {
  title: string
  openUrl: string
}

const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "町長",
  "副教育長",
  "教育長",
  "事務局長",
  "主幹",
  "主事",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "局長",
  "係長",
  "議員",
  "委員",
] as const

const ANSWER_ROLE_SUFFIXES = [
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "主幹",
  "主事",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
] as const

const DIRECT_NAME_ROLE_SUFFIXES = [
  "議長",
  "副議長",
  "町長",
  "副町長",
  "教育長",
  "副教育長",
] as const

/** BackShelf テキスト表示 HTML から本文文字列を取り出す */
export function extractPageText(html: string): string | null {
  const match = html.match(/<div class="pageTextArea">\s*([\s\S]*?)\s*<\/div>/)
  if (!match?.[1]) return null

  return match[1]
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** viewer HTML から総ページ数を抽出する */
export function extractTotalPages(html: string): number | null {
  const match = html.match(/"FILPAGE"\s*:\s*(\d+)/)
  if (!match?.[1]) return null
  return parseInt(match[1], 10)
}

/** 和暦日付を YYYY-MM-DD に変換する */
export function parseJapaneseDate(text: string): string | null {
  const normalized = toHalfWidth(text)
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/)
  if (!match) return null

  const era = match[1]!
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10)
  const month = parseInt(match[3]!, 10)
  const day = parseInt(match[4]!, 10)
  const westernYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * 発言ヘッダーから話者名・役職・本文を抽出する。
 *
 * 典型例:
 *   ○鈴木議長 皆さん、おはようございます。
 *   ○佐藤町長 お答えをいたします。
 *   ○4番五十嵐議員 おはようございます。
 *   ○樋口産業振興課長 再質問にお答えしたいと思います。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null
  speakerRole: string | null
  content: string
} {
  const stripped = text.replace(/^[○◯●]\s*/, "").trim()
  const match = stripped.match(/^(\S+)\s+([\s\S]*)$/)
  if (!match) {
    return { speakerName: null, speakerRole: null, content: stripped }
  }

  const header = match[1]!.replace(/[\s　]+/g, "")
  const content = match[2]!.trim()

  const memberMatch = toHalfWidth(header).match(/^(\d+)番(.+?)議員$/)
  if (memberMatch?.[2]) {
    return {
      speakerName: memberMatch[2].trim(),
      speakerRole: "議員",
      content,
    }
  }

  for (const suffix of DIRECT_NAME_ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      const speakerName = header.slice(0, -suffix.length).trim() || null
      return {
        speakerName,
        speakerRole: suffix,
        content,
      }
    }
  }

  if (ROLE_SUFFIXES.includes(header as (typeof ROLE_SUFFIXES)[number])) {
    return {
      speakerName: null,
      speakerRole: header,
      content,
    }
  }

  for (const suffix of ROLE_SUFFIXES) {
    if (header.endsWith(suffix)) {
      return {
        speakerName: null,
        speakerRole: header,
        content,
      }
    }
  }

  return {
    speakerName: null,
    speakerRole: null,
    content,
  }
}

/** 役職から発言種別を分類する */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark"

  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole.endsWith("委員長") ||
    speakerRole.endsWith("委員")
  ) {
    return "remark"
  }

  if (ANSWER_ROLE_SUFFIXES.some((suffix) => speakerRole.endsWith(suffix))) {
    return "answer"
  }

  return "question"
}

function shouldSkipHeaderBlock(text: string): boolean {
  return /^(議事日程|出席議員|欠席議員|応招議員|不応招議員|本日の会議に付された事件|地方自治法第121条|本会議に職務のため出席した者)/.test(
    text,
  )
}

/** 全ページ本文から ParsedStatement 配列を生成する */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯●◎])/)
  const statements: ParsedStatement[] = []
  let offset = 0

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed || !/^[○◯●]/.test(trimmed)) continue

    const normalized = trimmed.replace(/\s+/g, " ")
    const parsed = parseSpeaker(normalized)

    if (!parsed.content) continue
    if (shouldSkipHeaderBlock(parsed.content)) continue

    const content = parsed.content.trim()
    if (!content) continue

    const contentHash = createHash("sha256").update(content).digest("hex")
    const startOffset = offset
    const endOffset = offset + content.length

    statements.push({
      kind: classifyKind(parsed.speakerRole),
      speakerName: parsed.speakerName,
      speakerRole: parsed.speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    })

    offset = endOffset + 1
  }

  return statements
}

async function resolveViewerSession(openUrl: string): Promise<{
  cookie: string
  filseq: string
  origin: string
} | null> {
  const result = await fetchPage(openUrl)
  if (!result) return null

  const finalUrl = new URL(result.finalUrl)
  const filseq = finalUrl.searchParams.get("filseq")
  if (!filseq) {
    console.warn(`[074071-bandai] filseq not found: ${result.finalUrl}`)
    return null
  }

  return {
    cookie: buildCookieHeader(result.headers),
    filseq,
    origin: finalUrl.origin,
  }
}

async function fetchViewerInfo(
  origin: string,
  filseq: string,
  cookie: string,
): Promise<{ totalPages: number } | null> {
  const url = `${origin}/bookview/view.php?filseq=${filseq}&page=1`
  const result = await fetchPage(url, cookie)
  if (!result) return null

  const totalPages = extractTotalPages(result.html)
  if (!totalPages) {
    console.warn(`[074071-bandai] total pages not found: filseq=${filseq}`)
    return null
  }

  return { totalPages }
}

async function fetchFullText(
  origin: string,
  filseq: string,
  totalPages: number,
  cookie: string,
): Promise<string | null> {
  const pages: string[] = []

  for (let page = 1; page <= totalPages; page++) {
    const url = `${origin}/ajax/ajax_ShowText.php?filseq=${filseq}&leftPage=${page}&dualPage=false`
    const result = await fetchPage(url, cookie)
    if (!result) return null

    const pageText = extractPageText(result.html)
    if (!pageText) continue

    pages.push(pageText.replace(/^\d+\s+/, "").trim())
  }

  return pages.length > 0 ? pages.join("\n") : null
}

export async function fetchMeetingData(
  params: BandaiDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const session = await resolveViewerSession(params.openUrl)
  if (!session) return null

  const viewerInfo = await fetchViewerInfo(
    session.origin,
    session.filseq,
    session.cookie,
  )
  if (!viewerInfo) return null

  const fullText = await fetchFullText(
    session.origin,
    session.filseq,
    viewerInfo.totalPages,
    session.cookie,
  )
  if (!fullText) return null

  const heldOn = parseJapaneseDate(fullText)
  if (!heldOn) return null

  const statements = parseStatements(fullText)
  if (statements.length === 0) return null

  return {
    municipalityCode,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn,
    sourceUrl: params.openUrl,
    externalId: `bandai_${session.filseq}`,
    statements,
  }
}

