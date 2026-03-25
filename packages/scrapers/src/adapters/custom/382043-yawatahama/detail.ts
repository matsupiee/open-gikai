/**
 * 八幡浜市議会 会議録 — detail フェーズ
 *
 * 会議録 HTML ページから全発言を抽出し、MeetingData に変換する。
 *
 * 発言者パターン:
 *   ○議長（菊池　彰君）　テキスト
 *   ○市長（大城一郎君）　テキスト
 *   ○総務課長（河野光徳君）　テキスト
 *
 * 登壇表記はスキップ:
 *   〔市長　大城一郎君登壇〕
 *
 * 開催日:
 *   令和X年X月X日（曜日）　午前10時開議
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { detectMeetingType, fetchPage, toSeireki } from "./shared";
import type { YawatahamaDocument } from "./list";

/** 行政側の役職キーワード（答弁者として分類する） */
const ANSWER_ROLE_KEYWORDS = [
  "市長",
  "副市長",
  "教育長",
  "部長",
  "局長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "事務局長",
  "委員長",
];

/**
 * 発言行から話者名・役職・本文を抽出する。
 *
 * 八幡浜市のフォーマット（役職前置、氏名は括弧内）:
 *   ○議長（菊池　彰君）　テキスト
 *   ○市長（大城一郎君）　テキスト
 *   ○総務課長（河野光徳君）　テキスト
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○{役職}（{名前}君）{スペース}{本文} のパターン
  const match = text.match(/^○(.+?)（(.+?)(?:君|さん|氏)?）[\s　]*([\s\S]*)/);
  if (!match) {
    return { speakerName: null, speakerRole: null, content: text.trim() };
  }

  const role = match[1]!.trim();
  // 名前から「君」「さん」「氏」を除去（括弧内に残っている場合）
  const name = match[2]!.replace(/[君さん氏]$/, "").trim();
  const content = match[3]!.trim();

  return { speakerName: name, speakerRole: role, content };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
  if (!speakerRole) return "remark";

  // 議長・副議長の進行発言
  if (speakerRole === "議長" || speakerRole === "副議長") return "remark";

  // 行政側の答弁
  for (const keyword of ANSWER_ROLE_KEYWORDS) {
    if (speakerRole.includes(keyword)) return "answer";
  }

  // それ以外（議員名等）は質問
  return "question";
}

/**
 * HTML から開催日を抽出する。
 *
 * パターン: 令和X年X月X日（曜日）
 * 全角数字にも対応。
 */
export function parseHeldOn(html: string): string | null {
  // 全角数字を半角に変換
  const normalized = html.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  const dateMatch = normalized.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (!dateMatch) return null;

  const year = toSeireki(dateMatch[1]!, dateMatch[2]!);
  if (!year) return null;

  const month = parseInt(dateMatch[3]!, 10);
  const day = parseInt(dateMatch[4]!, 10);

  if (isNaN(month) || isNaN(day)) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議録 HTML から発言一覧をパースする。
 *
 * <p> タグのテキストを順次処理し、○ で始まる行を発言者として識別する。
 * 登壇表記（〔...登壇〕）はスキップ。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // HTML を整形してテキスト行に変換
  const cleaned = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  const lines = cleaned.split("\n");

  let currentSpeaker: { name: string | null; role: string | null } | null = null;
  let currentContent: string[] = [];
  let offset = 0;

  const flush = () => {
    if (!currentSpeaker && currentContent.length === 0) return;

    const content = currentContent.join("\n").trim();
    if (!content) {
      currentSpeaker = null;
      currentContent = [];
      return;
    }

    const contentHash = createHash("sha256").update(content).digest("hex");
    const startOffset = offset;
    const endOffset = offset + content.length;

    statements.push({
      kind: currentSpeaker ? classifyKind(currentSpeaker.role) : "remark",
      speakerName: currentSpeaker?.name ?? null,
      speakerRole: currentSpeaker?.role ?? null,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + 1;
    currentSpeaker = null;
    currentContent = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 登壇表記はスキップ
    if (/^〔.+登壇〕$/.test(trimmed)) continue;

    // 時刻行はスキップ（"午前10時" で始まる行 or 日付+時刻の行）
    if (/^午[前後][０-９0-9\d]+時/.test(trimmed)) {
      flush();
      continue;
    }

    // 日付＋時刻が含まれる行はスキップ（例: 令和7年12月10日（水曜日）　午前10時開議）
    if (/(令和|平成|昭和)(元|\d+|[０-９]+)年.+午[前後]/.test(trimmed)) {
      flush();
      continue;
    }

    // 日程行はスキップ
    if (/^議事日程/.test(trimmed) || /^日程第[０-９0-9]+/.test(trimmed)) {
      flush();
      continue;
    }

    // ○ で始まる行 = 新しい発言者
    if (trimmed.startsWith("○")) {
      flush();
      const { speakerName, speakerRole, content } = parseSpeaker(trimmed);
      currentSpeaker = { name: speakerName, role: speakerRole };
      if (content) {
        currentContent.push(content);
      }
      continue;
    }

    // 継続行（発言者がいる場合のみ追加）
    if (currentSpeaker !== null) {
      currentContent.push(trimmed);
    }
  }

  flush();

  return statements;
}

/**
 * 会議録ページから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: YawatahamaDocument,
  municipalityId: string,
): Promise<MeetingData | null> {
  const url = doc.detailUrl;
  const html = await fetchPage(url);
  if (!html) return null;

  // h2 からタイトルを取得
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const title = h2Match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? doc.sessionTitle;

  const heldOn = parseHeldOn(html);
  if (!heldOn) {
    console.warn(`[yawatahama] heldOn parse failed: ${url}`);
  }

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  // externalId はパスのコード部分を使用
  const pathCodeMatch = doc.path.match(/\/gikai\/(\d+)\//);
  const externalId = pathCodeMatch ? `yawatahama_${pathCodeMatch[1]}` : null;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(title),
    heldOn: heldOn ?? `${doc.year}-01-01`,
    sourceUrl: url,
    externalId,
    statements,
  };
}
