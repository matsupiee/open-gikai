/**
 * 四万十町議会 — detail フェーズ
 *
 * 会議録詳細ページ（giji_dtl.php?hdnKatugi=130&hdnID={ID}）から
 * HTML 本文を取得し、発言を ParsedStatement 配列に変換する。
 *
 * ページ構造:
 * - メタ情報（会議名・開催日）: パンくずリスト等から取得
 * - 発言: ○ マーカーで区切られたプレーンテキスト
 *
 * 発言フォーマット:
 *   ○議長（緒方正綱君）
 *   ○町長（中尾博憲君）
 *   ○４番（村井眞菜君）
 *   ○11番（下元真之君）
 *   ○企画課長（冨田努君）
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShimantoRecord } from "./list";
import { fetchPage, detectMeetingType } from "./shared";

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "村長",
  "副村長",
  "市長",
  "副市長",
  "教育長",
  "副教育長",
  "教育次長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "次長",
  "担当",
]);

// 進行役の役職
const REMARK_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
]);

// 役職サフィックス（長い方を先に配置して誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副町長",
  "副村長",
  "副市長",
  "町長",
  "村長",
  "市長",
  "副教育長",
  "教育次長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "部長",
  "課長補佐",
  "副課長",
  "課長",
  "室長",
  "次長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "担当",
  "議員",
  "委員",
];

/**
 * ○ マーカー付きの発言テキストから話者情報を抽出する。
 *
 * 四万十町の発言パターン:
 *   ○議長（緒方正綱君） 発言内容
 *   ○町長（中尾博憲君） 発言内容
 *   ○４番（村井眞菜君） 発言内容
 *   ○11番（下元真之君） 発言内容
 *   ○企画課長（冨田努君） 発言内容
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン1: カッコ形式 — role（name + 君|様|議員）content
  const parenMatch = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (parenMatch) {
    const rolePart = parenMatch[1]!.trim();
    const rawName = parenMatch[2]!.replace(/[\s　]+/g, "").trim();
    const content = parenMatch[3]!.trim();

    // 番号議員パターン: "４番" や "11番" → 議員
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    const role = matchRole(rolePart);
    return {
      speakerName: rawName,
      speakerRole: role ?? (rolePart || null),
      content,
    };
  }

  // パターン2: スペース区切り形式
  const tokens = stripped.split(/\s+/);
  if (tokens.length >= 3) {
    for (let i = 1; i <= Math.min(3, tokens.length - 2); i++) {
      const rolePart = tokens[i]!;
      const role = matchRole(rolePart);
      if (role) {
        const name = tokens.slice(0, i).join("");
        const content = tokens.slice(i + 1).join(" ").trim();
        return { speakerName: name, speakerRole: role, content };
      }
    }
  }

  return { speakerName: null, speakerRole: null, content: stripped.trim() };
}

/**
 * 役職文字列からロールサフィックスをマッチさせる。
 * 長いパターンを先にチェックして誤マッチを防ぐ。
 */
function matchRole(rolePart: string): string | null {
  for (const suffix of ROLE_SUFFIXES) {
    if (rolePart === suffix || rolePart.endsWith(suffix)) {
      return suffix;
    }
  }
  return null;
}

/** 役職から発言種別を分類 */
export function classifyKind(
  speakerRole: string | null,
): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";
  if (ANSWER_ROLES.has(speakerRole)) return "answer";
  if (REMARK_ROLES.has(speakerRole)) return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * HTML テキストから発言を ParsedStatement 配列に変換する。
 *
 * 四万十町の HTML 本文は ○ マーカーで発言が区切られる。
 * ○ マーカーがない場合は null を返す（statements が空なら fetchMeetingData は null を返す）。
 */
export function parseStatements(text: string): ParsedStatement[] | null {
  // 正規化: 連続空白を単一スペースに統一
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  if (!/[○◯◎●]/.test(normalized)) return null;

  const blocks = normalized.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 出席表などの短いマーカーをスキップ
    const afterMarker = trimmed.replace(/^[○◯◎●]\s*/, "").trim();
    if (afterMarker.length < 5) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed)) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
    if (!content) continue;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;
    statements.push({
      kind: classifyKind(speakerRole),
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });
    offset = endOffset + 1;
  }

  if (statements.length === 0) return null;
  return statements;
}

/**
 * 詳細ページの HTML から会議録テキスト本文を抽出する。
 *
 * 四万十町の詳細ページは HTML 内にプレーンテキストが直接埋め込まれている。
 * class="gijiroku_page" の div 内のテキストを優先的に取得する。
 */
export function extractBodyText(html: string): string {
  // スクリプト、スタイル等を除去
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // gijiroku_page クラスの div 開始位置を探す（会議録本文）
  const gijirokuPageMatch = cleaned.match(/<div[^>]*class="gijiroku_page"[^>]*>([\s\S]*)/i);
  if (gijirokuPageMatch) {
    cleaned = gijirokuPageMatch[1]!;
  } else {
    // フォールバック: gijiroku クラスの div 開始位置を探す
    const gijirokuMatch = cleaned.match(/<div[^>]*class="gijiroku"[^>]*>([\s\S]*)/i);
    if (gijirokuMatch) {
      cleaned = gijirokuMatch[1]!;
    }
  }

  return cleaned
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * 詳細ページの HTML からメタ情報（会議名・開催日）を抽出する。
 *
 * パンくずリスト例:
 *   会議録 令和８年 » 令和８年第１回臨時会(開催日:2026/01/29)
 */
export function extractMeta(html: string): { title: string | null; heldOn: string | null } {
  // HTML 全体から開催日パターンを検索（HTMLタグを除去してから検索）
  const plainText = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&raquo;/g, "»")
    .replace(/&#\d+;/g, "");

  // 開催日パターンを検索: YYYY/MM/DD 形式
  const dateMatch = plainText.match(/開催日[:：](\d{4})\/(\d{2})\/(\d{2})/);
  const heldOn = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    : null;

  // 会議名を抽出: 令和/平成 + 定例会|臨時会|委員会 を含むテキスト（全角・半角数字対応）
  const titleMatch = plainText.match(/((?:令和|平成)[０-９\d]+年[^\n»>]*(?:定例会|臨時会|委員会)[^»>\n]*)/);
  const title = titleMatch ? titleMatch[1]!.trim() : null;

  return { title, heldOn };
}

/**
 * 詳細レコードから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  record: ShimantoRecord,
  municipalityId: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(record.detailUrl);
  if (!html) return null;

  const bodyText = extractBodyText(html);
  const statements = parseStatements(bodyText);
  if (statements === null) return null;

  // 開催日: record.heldOn（list フェーズで取得済み）を優先し、
  // 取得できていない場合は詳細ページから抽出
  let heldOn = record.heldOn;
  if (!heldOn) {
    const meta = extractMeta(html);
    heldOn = meta.heldOn;
  }

  // heldOn が解析できない場合は null を返す
  if (!heldOn) return null;

  // 会議タイトル: record.title を使用
  const title = record.title;

  // externalId: hdnId から生成
  const externalId = `shimanto_${record.hdnId}`;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title),
    heldOn,
    sourceUrl: record.detailUrl,
    externalId,
    statements,
  };
}
