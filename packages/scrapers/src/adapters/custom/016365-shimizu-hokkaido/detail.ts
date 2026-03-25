/**
 * 清水町議会（北海道） 会議録 — detail フェーズ
 *
 * HTML の会議録ページを取得し、<p> タグの連続から発言を解析する。
 *
 * 発言フォーマット:
 *   ○議長（山下清美）　ただいまから…
 *   ○総務課長（藤田哲也）　お答えします。
 *   ○４番（川上　均）　質問します。
 *
 * 議事区切り:
 *   ◇・・・・・・・・・・・・・・・・・・・・・・◇
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShimizuHokkaidoMeeting } from "./list";
import {
  detectMeetingType,
  fetchPage,
  toHalfWidth,
} from "./shared";
import { parseMeetingPageMeta, parseYearFromTitle } from "./list";

// 役職サフィックス（長い方を先に配置して誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "委員",
  "議員",
  "副部長",
  "副課長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "次長",
  "主査",
  "補佐",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山下清美）　→ role=議長, name=山下清美
 *   ○総務課長（藤田哲也）→ role=課長, name=藤田哲也
 *   ○４番（川上　均）　→ role=議員, name=川上 均
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name）content
  const match = stripped.match(/^(.+?)[（(](.+?)[）)]\s*([\s\S]*)/);
  if (match) {
    const rolePart = match[1]!.trim();
    // 全角スペースを含む氏名を正規化（内部スペースは保持、前後のみトリム）
    const rawName = match[2]!.trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○４番（川上　均）、○4番（田中）（全角数字対応）
    const halfWidthRole = toHalfWidth(rolePart);
    if (/^[\d]+番$/.test(halfWidthRole)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い方から順に試みる）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch && /^[○◯◎●]/.test(text)) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name =
          header.length > suffix.length
            ? header.slice(0, -suffix.length)
            : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (
    speakerRole === "議長" ||
    speakerRole === "副議長" ||
    speakerRole === "委員長" ||
    speakerRole === "副委員長"
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * HTML から <p> タグのテキストを抽出してプレーンテキストに変換する。
 */
export function extractTextFromHtml(html: string): string {
  // メインコンテンツエリアを抽出（新サイト・旧サイト対応）
  // 新サイト: メインコンテンツ領域
  // 旧サイト: #contents_in
  let contentHtml = html;

  const mainMatch =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    html.match(/id="contents_in"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

  if (mainMatch) {
    contentHtml = mainMatch[1]!;
  }

  // <p> タグのテキストを連結
  const paragraphs: string[] = [];
  const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of contentHtml.matchAll(pPattern)) {
    const text = match[1]!.replace(/<[^>]+>/g, "").trim();
    if (text) {
      paragraphs.push(text);
    }
  }

  return paragraphs.join("\n");
}

/**
 * 会議録テキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const lines = text.split(/\n/);
  const statements: ParsedStatement[] = [];
  let currentSpeakerName: string | null = null;
  let currentSpeakerRole: string | null = null;
  let currentContentLines: string[] = [];
  let offset = 0;

  function flushStatement() {
    if (currentContentLines.length === 0) return;
    const content = currentContentLines.join(" ").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeakerRole),
      speakerName: currentSpeakerName,
      speakerRole: currentSpeakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    currentContentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 議事区切り（◇・・・◇）はスキップ
    if (/^◇[・.]+◇$/.test(trimmed)) continue;

    // 時刻表記（午前10時45分）はスキップ
    if (/^（午[前後]\d+時\d*分）$/.test(trimmed)) continue;

    // 傍聴者コメント（（「異議なし」と呼ぶ者あり））はスキップ
    if (/^（「[^」]+」[^）]*）$/.test(trimmed)) continue;

    // ○ マーカーで始まる発言者行
    if (/^[○◯◎●]/.test(trimmed)) {
      // ◎ で始まる議事日程見出しはスキップ
      if (/^◎/.test(trimmed)) continue;

      // ト書き（登壇等）をスキップ
      if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) continue;

      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);

      // 前の発言をフラッシュ
      flushStatement();

      currentSpeakerName = speakerName;
      currentSpeakerRole = speakerRole;
      if (content) {
        currentContentLines.push(content);
      }
    } else if (currentSpeakerName !== null || currentSpeakerRole !== null) {
      // 発言の継続行
      currentContentLines.push(trimmed);
    }
  }

  // 最後の発言をフラッシュ
  flushStatement();

  return statements;
}

/**
 * 会議録ページの HTML を取得・解析して MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: ShimizuHokkaidoMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(meeting.pageUrl);
  if (!html) return null;

  // ページからメタ情報を取得
  // heldOn の year を解決するため、タイトルから年を抽出
  const pageMeta = parseMeetingPageMeta(html, 0);
  const titleYear = parseYearFromTitle(pageMeta.title);

  // 再度メタ情報を年付きで取得
  const metaWithYear = titleYear
    ? parseMeetingPageMeta(html, titleYear)
    : pageMeta;

  const title = metaWithYear.title || meeting.title || pageMeta.title;
  const heldOn = metaWithYear.heldOn;

  if (!heldOn) return null;

  const text = extractTextFromHtml(html);
  const statements = parseStatements(text);

  if (statements.length === 0) return null;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: meeting.pageUrl,
    externalId: meeting.pageKey,
    statements,
  };
}
