/**
 * gijiroku.com スクレイパー — detail フェーズ
 *
 * voiweb.exe CGI (ACT=203) から議事録本文を取得し、MeetingData に変換する。
 *
 * HTML 構造:
 *   発言は <A NAME="HUID{id}"></A> で区切られ、
 *   各発言は以下のパターンで始まる:
 *     ◎役職（氏名君）　本文...   → 行政職員（◎マーク）
 *     ○役職（氏名君）　本文...   → 議員・議長（○マーク）
 *     △議題名                   → 議題区切り（スキップ）
 *
 * エンコーディング: Shift_JIS
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { decodeShiftJis } from "../list/decode-shift-jis";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/**
 * voiweb.exe ACT=203 から議事録本文を取得し、MeetingData に変換する。
 */
export async function fetchMeetingDetail(
  baseUrl: string,
  fino: string,
  municipalityId: string,
  unid: string,
  title: string,
  dateLabel: string
): Promise<MeetingData | null> {
  try {
    const contentUrl = buildDetailUrl(baseUrl, fino);
    if (!contentUrl) return null;

    const res = await fetch(contentUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    const html = decodeShiftJis(bytes);

    const statements = extractStatements(html);

    const heldOn = extractDateFromContent(html) ?? parseDateFromLabel(dateLabel);
    if (!heldOn) return null;

    const meetingType = detectMeetingType(title);
    const externalId = `gijiroku_${unid}`;

    return {
      municipalityId,
      title,
      meetingType,
      heldOn,
      sourceUrl: contentUrl,
      externalId,
      statements,
    };
  } catch {
    return null;
  }
}

/**
 * baseUrl と FINO から ACT=203（本文フレーム）の URL を構築する。
 */
/** @internal テスト用にexport */
export function buildDetailUrl(baseUrl: string, fino: string): string | null {
  try {
    const url = new URL(baseUrl);
    url.protocol = "https:";

    const voicesMatch = url.pathname.match(/^(.*\/voices)\//i);
    if (!voicesMatch?.[1]) return null;

    const voicesPath = voicesMatch[1];
    return `${url.origin}${voicesPath}/cgi/voiweb.exe?ACT=203&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FINO=${fino}&HATSUGENMODE=0&HYOUJIMODE=0&STYLE=0`;
  } catch {
    return null;
  }
}

/**
 * 本文 HTML から開催日を抽出する。
 * 形式: "令和６年12月５日" や "令和 6年 12月 5日" など
 */
/** @internal テスト用にexport */
export function extractDateFromContent(html: string): string | null {
  // 「令和X年M月D日」パターン
  const m = html.match(
    /(?:令和|平成|昭和)\s*[0-9０-９]+\s*年\s*([0-9０-９]+)\s*月\s*([0-9０-９]+)\s*日/
  );
  if (!m) return null;

  const eraMatch = html.match(
    /(令和|平成|昭和)\s*([0-9０-９]+)\s*年\s*[0-9０-９]+\s*月\s*[0-9０-９]+\s*日/
  );
  if (!eraMatch) return null;

  const era = eraMatch[1]!;
  const eraYear = toHalfWidth(eraMatch[2]!);
  const month = toHalfWidth(m[1]!);
  const day = toHalfWidth(m[2]!);

  const gregorianYear = eraToGregorian(era, Number.parseInt(eraYear, 10));
  if (!gregorianYear) return null;

  return `${gregorianYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * 日付ラベル（例: "12月05日-01号"）から月日を抽出し、
 * 年を推定して YYYY-MM-DD を返す。フォールバック用。
 */
/** @internal テスト用にexport */
export function parseDateFromLabel(dateLabel: string): string | null {
  const m = dateLabel.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  // 年が不明なのでフォールバック用としては null を返す
  return null;
}

/**
 * 和暦を西暦に変換する。
 */
function eraToGregorian(era: string, year: number): number | null {
  switch (era) {
    case "令和":
      return 2018 + year;
    case "平成":
      return 1988 + year;
    case "昭和":
      return 1925 + year;
    default:
      return null;
  }
}

/**
 * 全角数字を半角に変換する。
 */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * タイトルから会議種別を決定する。
 */
/** @internal テスト用にexport */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "市長",
  "町長",
  "村長",
  "副市長",
  "副町長",
  "副村長",
  "副知事",
  "知事",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
  "事務局長",
  "議会事務局長",
  "議会局長",
  "書記",
  "参事",
  "次長",
  "理事",
  "総務部長",
  "財政部長",
]);

/**
 * 発言ヘッダーから speakerName / speakerRole を抽出する。
 *
 * 形式:
 *   ◎議会局長（川崎誠君） → speakerRole="議会局長", speakerName="川崎誠"
 *   ○臨時議長（酒井泉君） → speakerRole="臨時議長", speakerName="酒井泉"
 *   ○17番（山中真弓君）   → speakerRole="17番", speakerName="山中真弓"
 */
/** @internal テスト用にexport */
export function parseSpeakerHeader(header: string): {
  speakerName: string | null;
  speakerRole: string | null;
  prefix: string | null;
} {
  // ◎ or ○ 付きの発言ヘッダー
  const m = header.match(/^([◎○◯●])\s*(.+?)(?:（(.+?)）)?$/);
  if (!m) return { speakerName: null, speakerRole: null, prefix: null };

  const prefix = m[1]!;
  const role = m[2]!.trim();
  const rawName = m[3]?.trim() ?? null;

  const speakerName = rawName
    ? rawName.replace(/(さん|くん|君)$/, "").replace(/\s+/g, "").trim() || null
    : null;

  return {
    speakerRole: role || null,
    speakerName,
    prefix,
  };
}

/**
 * speakerRole と prefix から kind を決定する。
 *
 * ◎ マーク = 行政側（答弁者）
 * ○ マーク = 議員・議長
 */
/** @internal テスト用にexport */
export function classifyKind(
  speakerRole: string | null,
  prefix: string | null
): string {
  if (!speakerRole) return "remark";

  // ◎ マークは原則的に行政側
  if (prefix === "◎") return "answer";

  // 議員・委員
  if (speakerRole.endsWith("議員") || speakerRole.endsWith("委員"))
    return "question";
  // 議席番号（例: "17番"）
  if (/^[0-9０-９]+番$/.test(speakerRole)) return "question";
  // 議長・委員長
  if (
    speakerRole === "議長" ||
    speakerRole.endsWith("議長") ||
    speakerRole.endsWith("委員長")
  )
    return "remark";
  // 行政側役職
  for (const role of ANSWER_ROLES) {
    if (speakerRole === role || speakerRole.endsWith(role)) return "answer";
  }

  return "remark";
}

/**
 * HTML のテキストをクリーンアップする。
 * <BR> を改行に変換し、タグを除去する。
 */
/** @internal テスト用にexport */
export function cleanHtmlText(html: string): string {
  return html
    .replace(/<BR\s*\/?>/gi, "\n")
    .replace(/<P>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * voiweb.exe ACT=203 の本文 HTML から ParsedStatement 配列を生成する。
 *
 * 本文は <A NAME="HUID{id}"></A> で区切られたセグメントで構成される。
 * 各セグメントの先頭が ◎ or ○ で始まる場合は発言として抽出する。
 * △ で始まる場合は議題区切りのためスキップする。
 */
/** @internal テスト用にexport */
export function extractStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // HUID アンカーで分割
  const segments = html.split(/<A\s+NAME="HUID\d+">\s*<\/A>/i);

  for (let i = 1; i < segments.length; i++) {
    const rawText = cleanHtmlText(segments[i]!);
    if (!rawText) continue;

    // △ で始まる場合は議題区切り
    if (rawText.startsWith("△")) continue;
    // (名簿) (議題) などの補助テキスト
    if (rawText.startsWith("(") || rawText.startsWith("（")) continue;

    // 発言者ヘッダーと本文を分離
    const parsed = parseStatementText(rawText);
    if (!parsed) continue;

    const { speakerName, speakerRole, prefix, content } = parsed;
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(speakerRole, prefix),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
  }

  return statements;
}

/**
 * 発言テキストから発言者ヘッダーと本文を分離する。
 *
 * 形式: "◎役職（氏名君）　本文テキスト..." or "○役職（氏名君）　本文テキスト..."
 */
/** @internal テスト用にexport */
export function parseStatementText(rawText: string): {
  speakerName: string | null;
  speakerRole: string | null;
  prefix: string | null;
  content: string;
} | null {
  // ◎ or ○ で始まる発言
  const headerMatch = rawText.match(
    /^([◎○◯●][^（\n]*(?:（[^）]*）)?)\s*/
  );

  if (!headerMatch) {
    // マークなしのテキスト（前の発言の続きなど）
    return null;
  }

  const header = headerMatch[1]!;
  const content = rawText.substring(headerMatch[0].length).trim();

  if (!content) return null;

  const { speakerName, speakerRole, prefix } = parseSpeakerHeader(header);

  return { speakerName, speakerRole, prefix, content };
}
