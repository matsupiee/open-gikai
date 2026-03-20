/**
 * gijiroku.com スクレイパー — detail フェーズ
 *
 * voiweb.exe CGI から議事録本文を取得し、MeetingData に変換する。
 *
 * 取得フロー:
 *   1. ACT=203（HUID なし）でヘッダーページを取得 → 開催日を抽出
 *   2. ACT=202（サイドバー）で全発言の HUID 一覧を取得
 *   3. 各 HUID ごとに ACT=203&HUID={huid} で発言本文を取得
 *
 * 発言形式（本会議）:
 *   ◎役職（氏名君）　本文...   → 行政職員
 *   ○役職（氏名君）　本文...   → 議員・議長
 *
 * 発言形式（委員会）:
 *   ◎氏名　役職　　本文...     → 行政職員
 *   ○氏名　役職　　本文...     → 委員長等
 *   ◆氏名　役職　　本文...     → 委員（質問者）
 *
 * エンコーディング: Shift_JIS
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { decodeShiftJis } from "../list/decode-shift-jis";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

/**
 * voiweb.exe から議事録本文を取得し、MeetingData に変換する。
 *
 * 1. ACT=203（HUID なし）でヘッダーページを取得し、開催日を抽出する。
 * 2. ACT=202 でサイドバー（発言者一覧）を取得し、全 HUID を得る。
 * 3. 各 HUID ページ（ACT=203&HUID=xxx）を取得して発言を抽出する。
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

    // 1. ヘッダーページから開催日を取得
    const headerHtml = await fetchShiftJisPage(contentUrl);
    if (!headerHtml) return null;

    const heldOn =
      extractDateFromContent(headerHtml) ?? parseDateFromLabel(dateLabel);
    if (!heldOn) return null;

    // 2. サイドバーから全 HUID 一覧を取得
    const sidebarUrl = buildSidebarUrl(baseUrl, fino);
    if (!sidebarUrl) return null;

    const sidebarHtml = await fetchShiftJisPage(sidebarUrl);
    if (!sidebarHtml) return null;

    const huidList = parseSidebarHuids(sidebarHtml);

    // 3. 各 HUID ページから発言を取得
    const statements: ParsedStatement[] = [];
    let offset = 0;

    for (const huid of huidList) {
      const huidUrl = buildDetailUrlWithHuid(baseUrl, fino, huid);
      if (!huidUrl) continue;

      const pageHtml = await fetchShiftJisPage(huidUrl);
      if (!pageHtml) continue;

      const parsed = extractStatementFromHuidPage(pageHtml);
      if (!parsed) continue;

      const contentHash = createHash("sha256")
        .update(parsed.content)
        .digest("hex");
      const startOffset = offset;
      const endOffset = offset + parsed.content.length;

      statements.push({
        kind: classifyKind(parsed.speakerRole, parsed.prefix),
        speakerName: parsed.speakerName,
        speakerRole: parsed.speakerRole,
        content: parsed.content,
        contentHash,
        startOffset,
        endOffset,
      });

      offset = endOffset + 1;
    }

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
 * Shift_JIS エンコーディングのページを取得し、UTF-8 文字列として返す。
 */
async function fetchShiftJisPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    return decodeShiftJis(bytes);
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
    if (url.hostname.endsWith("gijiroku.com")) {
      url.protocol = "https:";
    }

    const voicesMatch = url.pathname.match(/^(.*\/voices)\//i);
    if (!voicesMatch?.[1]) return null;

    const voicesPath = voicesMatch[1];
    return `${url.origin}${voicesPath}/cgi/voiweb.exe?ACT=203&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FINO=${fino}&HATSUGENMODE=0&HYOUJIMODE=0&STYLE=0`;
  } catch {
    return null;
  }
}

/**
 * baseUrl と FINO から ACT=202（サイドバー / 発言者一覧）の URL を構築する。
 */
/** @internal テスト用にexport */
export function buildSidebarUrl(baseUrl: string, fino: string): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.hostname.endsWith("gijiroku.com")) {
      url.protocol = "https:";
    }

    const voicesMatch = url.pathname.match(/^(.*\/voices)\//i);
    if (!voicesMatch?.[1]) return null;

    const voicesPath = voicesMatch[1];
    return `${url.origin}${voicesPath}/cgi/voiweb.exe?ACT=202&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&FINO=${fino}&HATSUGENMODE=0&HYOUJIMODE=0&STYLE=0`;
  } catch {
    return null;
  }
}

/**
 * baseUrl、FINO、HUID から特定発言の ACT=203 URL を構築する。
 */
/** @internal テスト用にexport */
export function buildDetailUrlWithHuid(
  baseUrl: string,
  fino: string,
  huid: string
): string | null {
  try {
    const url = new URL(baseUrl);
    if (url.hostname.endsWith("gijiroku.com")) {
      url.protocol = "https:";
    }

    const voicesMatch = url.pathname.match(/^(.*\/voices)\//i);
    if (!voicesMatch?.[1]) return null;

    const voicesPath = voicesMatch[1];
    return `${url.origin}${voicesPath}/cgi/voiweb.exe?ACT=203&KENSAKU=0&SORT=0&KTYP=0,1,2,3&KGTP=1,3&HUID=${huid}&FINO=${fino}&HATSUGENMODE=0&HYOUJIMODE=0&STYLE=0`;
  } catch {
    return null;
  }
}

/**
 * サイドバー HTML（ACT=202）から発言の HUID 一覧を抽出する。
 * (名簿) エントリはスキップする。
 */
/** @internal テスト用にexport */
export function parseSidebarHuids(html: string): string[] {
  const huids: string[] = [];

  // サイドバーの各行: <A NAME="{huid}">...</A>...<B>label</B>
  // (名簿) はスキップ
  const pattern =
    /<A\s+NAME="(\d+)">\s*<\/A>.*?<B>([^<]+)<\/B>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const huid = match[1]!;
    const label = match[2]!.trim();

    // (名簿) や △ で始まるエントリはスキップ
    if (label === "(名簿)" || label.startsWith("△")) continue;

    huids.push(huid);
  }

  return huids;
}

/**
 * HUID ページ（ACT=203&HUID=xxx）の HTML から発言を抽出する。
 *
 * ページ内の <A NAME="HUID{id}"></A> の直後のテキストを解析する。
 */
/** @internal テスト用にexport */
export function extractStatementFromHuidPage(html: string): {
  speakerName: string | null;
  speakerRole: string | null;
  prefix: string | null;
  content: string;
} | null {
  // HUID アンカー以降のテキストを取得
  const anchorMatch = html.match(/<A\s+NAME="HUID\d+">\s*<\/A>/i);
  if (!anchorMatch) return null;

  const afterAnchor = html.substring(
    anchorMatch.index! + anchorMatch[0].length
  );

  // </FORM> または <SCRIPT の前までが本文
  const endIdx = afterAnchor.search(/<(?:FORM|SCRIPT|\/BODY)/i);
  const bodyHtml = endIdx >= 0 ? afterAnchor.substring(0, endIdx) : afterAnchor;

  const rawText = cleanHtmlText(bodyHtml);
  if (!rawText) return null;

  // △ で始まる場合は議題区切り
  if (rawText.startsWith("△")) return null;

  return parseStatementText(rawText);
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
 * 形式A（本会議）:
 *   ◎議会局長（川崎誠君） → speakerRole="議会局長", speakerName="川崎誠"
 *   ○臨時議長（酒井泉君） → speakerRole="臨時議長", speakerName="酒井泉"
 *   ○17番（山中真弓君）   → speakerRole="17番", speakerName="山中真弓"
 *
 * 形式B（委員会）:
 *   ◎中山　都市計画課長   → speakerRole="都市計画課長", speakerName="中山"
 *   ○高野　分科会委員長   → speakerRole="分科会委員長", speakerName="高野"
 *   ◆川田青星　分科会委員 → speakerRole="分科会委員", speakerName="川田青星"
 */
/** @internal テスト用にexport */
export function parseSpeakerHeader(header: string): {
  speakerName: string | null;
  speakerRole: string | null;
  prefix: string | null;
} {
  // 形式A: ◎/○/◆ + 役職（氏名君）
  const mA = header.match(/^([◎○◯●◆])\s*(.+?)（(.+?)）$/);
  if (mA) {
    const prefix = mA[1]!;
    const role = mA[2]!.trim();
    const rawName = mA[3]!.trim();
    const speakerName =
      rawName
        .replace(/(さん|くん|君)$/, "")
        .replace(/\s+/g, "")
        .trim() || null;
    return { speakerRole: role || null, speakerName, prefix };
  }

  // 形式B: ◎/○/◆ + 氏名　役職（全角スペース区切り）
  const mB = header.match(/^([◎○◯●◆])\s*(.+?)[\s　]+(.+)$/);
  if (mB) {
    const prefix = mB[1]!;
    const name = mB[2]!.trim();
    const role = mB[3]!.trim();
    const speakerName =
      name
        .replace(/(さん|くん|君)$/, "")
        .replace(/\s+/g, "")
        .trim() || null;
    return { speakerRole: role || null, speakerName, prefix };
  }

  // 形式C: ◎/○/◆ + 役職のみ（括弧・スペースなし）
  const mC = header.match(/^([◎○◯●◆])\s*(.+)$/);
  if (mC) {
    const prefix = mC[1]!;
    const role = mC[2]!.trim();
    return { speakerRole: role || null, speakerName: null, prefix };
  }

  return { speakerName: null, speakerRole: null, prefix: null };
}

/**
 * speakerRole と prefix から kind を決定する。
 *
 * ◎ マーク = 行政側（答弁者）
 * ○ マーク = 議員・議長
 * ◆ マーク = 委員（質問者）
 */
/** @internal テスト用にexport */
export function classifyKind(
  speakerRole: string | null,
  prefix: string | null
): string {
  if (!speakerRole) return "remark";

  // ◎ マークは原則的に行政側
  if (prefix === "◎") return "answer";

  // ◆ マークは委員会での質問者
  if (prefix === "◆") return "question";

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
 * 形式A（本会議）: "◎役職（氏名君）　本文テキスト..."
 * 形式B（委員会）: "◎氏名　役職　　本文テキスト..."
 *
 * 形式B では「氏名　役職」の後に全角スペース2つ以上（　　）で本文が続く。
 */
/** @internal テスト用にexport */
export function parseStatementText(rawText: string): {
  speakerName: string | null;
  speakerRole: string | null;
  prefix: string | null;
  content: string;
} | null {
  // 形式A: ◎/○/◆ + 役職（氏名君）　本文
  const headerMatchA = rawText.match(
    /^([◎○◯●◆][^（\n]*（[^）]*）)\s*/
  );
  if (headerMatchA) {
    const header = headerMatchA[1]!;
    const content = rawText.substring(headerMatchA[0].length).trim();
    if (!content) return null;
    const { speakerName, speakerRole, prefix } = parseSpeakerHeader(header);
    return { speakerName, speakerRole, prefix, content };
  }

  // 形式B: ◎/○/◆ + 氏名　役職　　本文（全角スペース2つ以上で本文と分離）
  const headerMatchB = rawText.match(
    /^([◎○◯●◆]\S+[\s　]+\S+)[\s　]{2,}/
  );
  if (headerMatchB) {
    const header = headerMatchB[1]!;
    const content = rawText.substring(headerMatchB[0].length).trim();
    if (!content) return null;
    const { speakerName, speakerRole, prefix } = parseSpeakerHeader(header);
    return { speakerName, speakerRole, prefix, content };
  }

  // 形式C: ◎/○/◆ + 役職のみ　本文（括弧なし、スペース1つ）
  const headerMatchC = rawText.match(
    /^([◎○◯●◆][^\s　（\n]+)\s*/
  );
  if (headerMatchC) {
    const header = headerMatchC[1]!;
    const content = rawText.substring(headerMatchC[0].length).trim();
    if (!content) return null;
    const { speakerName, speakerRole, prefix } = parseSpeakerHeader(header);
    return { speakerName, speakerRole, prefix, content };
  }

  return null;
}
