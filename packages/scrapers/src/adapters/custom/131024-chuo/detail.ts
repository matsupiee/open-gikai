/**
 * 中央区議会 会議録検索システム — 詳細取得
 *
 * 個別の会議録ページを取得し、MeetingData に変換する。
 *
 * HTML 構造:
 *   - タイトル: <h1>
 *   - 発言: <p class="kaigi02"> 内で ○ で始まるものが発言者付き
 *   - 発言者パターン（本会議）:
 *     ○議長（原田賢一議員）  → role="議長", name="原田賢一"
 *     ○十一番（青木かの議員）→ role="十一番", name="青木かの"
 *   - 発言者パターン（委員会）:
 *     ○礒野委員長           → role="委員長", name="礒野"
 *     ○永井委員             → role="委員", name="永井"
 *     ○小森広報課長         → role="課長", name="小森広報"
 *   - 本文: <br> 以降のテキスト
 *   - ○ なしの <p class="kaigi02"> は前の発言者の続き
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchPage, detectMeetingType } from "./shared";

/**
 * 会議録ページを取得し、MeetingData に変換して返す。
 */
export async function fetchMeetingData(
  params: { detailUrl: string; title: string; heldOn: string },
  municipalityId: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(params.detailUrl);
  if (!html) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  const externalId = `chuo_cgi_${createHash("sha256").update(params.detailUrl).digest("hex").slice(0, 16)}`;

  return {
    municipalityId,
    title: params.title,
    meetingType: detectMeetingType(params.title),
    heldOn: params.heldOn,
    sourceUrl: params.detailUrl,
    externalId,
    statements,
  };
}

/**
 * HTML から発言を抽出する。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const pPattern = /<p\s+class="kaigi02">([\s\S]*?)<\/p>/gi;

  let currentSpeaker: { name: string | null; role: string | null } | null =
    null;
  let continuationParts: string[] = [];

  const flushContinuation = () => {
    if (continuationParts.length === 0 || !currentSpeaker) return;
    const content = continuationParts.join("\n").trim();
    if (!content) return;

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: classifyKind(currentSpeaker.role),
      speakerName: currentSpeaker.name,
      speakerRole: currentSpeaker.role,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    continuationParts = [];
  };

  let match;
  while ((match = pPattern.exec(html)) !== null) {
    const inner = match[1] ?? "";
    const text = cleanHtml(inner);

    if (!text) continue;

    if (text.startsWith("○")) {
      flushContinuation();

      const parsed = parseSpeaker(text);
      currentSpeaker = { name: parsed.speakerName, role: parsed.speakerRole };
      if (parsed.content) {
        continuationParts.push(parsed.content);
      }
    } else {
      if (currentSpeaker) {
        continuationParts.push(text);
      }
    }
  }

  flushContinuation();

  return statements;
}

// -- 行政側の役職サフィックス（答弁者として分類） --
const ANSWER_SUFFIXES = [
  "区長",
  "副区長",
  "教育長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "次長",
  "所長",
  "管理者",
  "担当",
];

/**
 * ○ 付きの発言行から speaker 情報と本文を分離する。
 *
 * パターン1（本会議）: ○議長（原田賢一議員）\n本文
 * パターン2（委員会）: ○小森広報課長\n本文
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.slice(1).trim();

  // パターン1: ROLE（NAME議員）or ROLE（NAMEくん/君）
  const bracketMatch = stripped.match(/^(.+?)（(.+?)）([\s\S]*)/);
  if (bracketMatch?.[1] && bracketMatch[2]) {
    const role = bracketMatch[1].trim();
    const rawName = bracketMatch[2]
      .replace(/(議員|さん|くん|君)$/u, "")
      .trim();
    const content = bracketMatch[3]?.trim() ?? "";
    return {
      speakerRole: role,
      speakerName: rawName || null,
      content,
    };
  }

  // パターン2: NAME+ROLE（委員会）
  const lines = stripped.split("\n");
  const speakerPart = (lines[0] ?? "").trim();
  const content = lines.slice(1).join("\n").trim();

  const speaker = parseCommitteeSpeaker(speakerPart);

  return {
    speakerName: speaker.name,
    speakerRole: speaker.role,
    content,
  };
}

/**
 * 委員会形式の発言者を解析する。
 *
 * "礒野委員長" → name="礒野", role="委員長"
 * "永井委員"   → name="永井", role="委員"
 * "小森広報課長" → name="小森広報", role="課長"
 */
export function parseCommitteeSpeaker(
  text: string,
): { name: string | null; role: string | null } {
  if (!text) return { name: null, role: null };

  // 「委員長」「副委員長」を先に試す（「委員」より長い）
  for (const suffix of ["副委員長", "委員長", "委員"]) {
    if (text.endsWith(suffix)) {
      const name = text.slice(0, -suffix.length).trim();
      return { name: name || null, role: suffix };
    }
  }

  for (const suffix of ANSWER_SUFFIXES) {
    if (text.endsWith(suffix)) {
      const name = text.slice(0, -suffix.length).trim();
      return { name: name || null, role: suffix };
    }
  }

  return { name: null, role: text };
}

/**
 * speakerRole から kind を決定する。
 */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";

  // 議席番号（本会議）
  if (/^[一二三四五六七八九十百]+番$/.test(speakerRole)) return "question";
  if (/^[0-9０-９]+番$/.test(speakerRole)) return "question";

  if (speakerRole === "委員") return "question";

  if (speakerRole === "議長" || speakerRole === "副議長") return "remark";
  if (speakerRole.endsWith("委員長")) return "remark";

  for (const suffix of ANSWER_SUFFIXES) {
    if (speakerRole === suffix || speakerRole.endsWith(suffix)) return "answer";
  }

  return "remark";
}

/**
 * HTML を平文に変換する。
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
