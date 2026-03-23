/**
 * 出水市議会 議事録検索システム — detail フェーズ
 *
 * detail_select/{councilId}/1 ページから全発言を取得し、MeetingData に変換する。
 *
 * ## ページ構造
 * - 発言テキストは `<p id="text_{N}">` 要素に格納
 * - 1つのp要素に複数の発言が混在する場合がある（セクション区切りと発言が同居）
 * - 発言形式1: `○役職（氏名議員）　本文`
 * - 発言形式2: `○氏名役職　本文`（括弧なし）
 * - セクション区切り: `△　日程第1...`
 * - 発言番号付き: `○１２番（氏名議員）`
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { buildDetailUrl, detectMeetingType, fetchPage } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "副議長",
  "副市長",
  "委員長",
  "議長",
  "市長",
  "教育長",
  "消防長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "委員",
  "議員",
] as const;

// 行政側の役職（答弁者として分類）
const ANSWER_ROLES = new Set([
  "市長",
  "副市長",
  "教育長",
  "消防長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
]);

/**
 * 発言テキストから話者名・役職・本文を抽出する。
 *
 * 対応フォーマット:
 * - `○議長（杉本尚喜議員）　本文`  → role=議長, name=杉本尚喜
 * - `○椎木伸一市長　本文`          → role=市長, name=椎木伸一
 * - `○１２番（吉元勇議員）　本文`  → role=null, name=吉元勇
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // 発言番号付き形式: ○数字番（氏名議員）　本文
  const numberedMatch = stripped.match(/^[\d０-９]+番（([^）]+?)(?:議員)?）[\s　]+([\s\S]*)/);
  if (numberedMatch) {
    const nameWithTitle = numberedMatch[1]!.trim();
    const content = numberedMatch[2]!.trim();
    // 名前から「議員」を除去
    const cleanName = nameWithTitle.replace(/議員$/, "").trim();
    return { speakerName: cleanName || null, speakerRole: "議員", content };
  }

  // 括弧付き形式: ○役職（氏名議員）　本文
  const bracketedMatch = stripped.match(/^([^（\s　]{1,15})（([^）]+?)(?:議員)?）[\s　]+([\s\S]*)/);
  if (bracketedMatch) {
    const role = bracketedMatch[1]!.trim();
    const name = bracketedMatch[2]!.trim();
    const content = bracketedMatch[3]!.trim();

    // role が ROLE_SUFFIXES に含まれる、または部分一致する場合
    for (const suffix of ROLE_SUFFIXES) {
      if (role === suffix || role.endsWith(suffix)) {
        const cleanName = name.replace(/議員$/, "").trim();
        return {
          speakerName: cleanName || null,
          speakerRole: suffix,
          content,
        };
      }
    }
    // 役職不明でも名前として扱う
    const cleanName = name.replace(/議員$/, "").trim();
    return { speakerName: cleanName || role, speakerRole: role || null, content };
  }

  // 括弧なし形式: ○氏名役職　本文
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch) {
    const header = headerMatch[1]!;
    const content = headerMatch[2]!.trim();

    // 役職サフィックスにマッチする場合
    for (const suffix of ROLE_SUFFIXES) {
      if (header.endsWith(suffix)) {
        const name = header.length > suffix.length
          ? header.slice(0, -suffix.length)
          : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }

    // ○マーカーがある場合は先頭を名前として扱う
    if (/^[○◯◎●]/.test(text)) {
      return { speakerName: header, speakerRole: null, content };
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
  ) {
    return "remark";
  }
  // 末尾が ANSWER_ROLES にマッチする場合
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * detail_select ページの HTML から発言を抽出する。
 *
 * `<p id="text_{N}">` 要素を収集し、○マーカーで発言者を識別する。
 * 各p要素は複数の発言ブロックを含む場合がある（改行区切り）。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // text_N の id を持つ p 要素を全て収集（ヘッダーの最初の要素はスキップ）
  const pRegex = /<p[^>]*id="text_(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let isFirst = true;

  for (const pMatch of html.matchAll(pRegex)) {
    if (isFirst) {
      // 最初のp要素はヘッダー（会議名・日付・出席者リスト）なのでスキップ
      isFirst = false;
      continue;
    }

    const rawContent = pMatch[2]!;

    // HTML タグを除去してプレーンテキストにする
    const plainText = rawContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, "\u3000")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code: string) =>
        String.fromCharCode(Number(code)),
      )
      .trim();

    if (!plainText) continue;

    // p要素のテキストを ○ または △ で始まるブロックに分割
    // 改行を基準に行を分割し、○か△で始まる行で区切る
    const lines = plainText.split(/\r?\n/);
    let currentBlock = "";

    const flushBlock = (block: string) => {
      const normalized = block.replace(/\s+/g, " ").trim();
      if (!normalized || normalized.length < 2) return;

      if (/^[○◯◎●]/.test(normalized)) {
        const { speakerName, speakerRole, content } = parseSpeaker(normalized);
        if (!content) return;

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
      } else if (/^△/.test(normalized)) {
        // セクション区切りは remark として追加
        const contentHash = createHash("sha256").update(normalized).digest("hex");
        const startOffset = offset;
        const endOffset = offset + normalized.length;
        statements.push({
          kind: "remark",
          speakerName: null,
          speakerRole: null,
          content: normalized,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      } else if (normalized.length > 10) {
        // その他のテキストも remark として追加
        const contentHash = createHash("sha256").update(normalized).digest("hex");
        const startOffset = offset;
        const endOffset = offset + normalized.length;
        statements.push({
          kind: "remark",
          speakerName: null,
          speakerRole: null,
          content: normalized,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      }
    };

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 区切り線（－や―のみで構成された行）はスキップ
      if (/^[－―\-─━]{3,}$/.test(trimmedLine)) continue;

      if (/^[○◯◎●△]/.test(trimmedLine) && currentBlock) {
        flushBlock(currentBlock);
        currentBlock = trimmedLine;
      } else {
        currentBlock = currentBlock ? `${currentBlock} ${trimmedLine}` : trimmedLine;
      }
    }

    if (currentBlock) {
      flushBlock(currentBlock);
      currentBlock = "";
    }
  }

  return statements;
}

/**
 * detail_select/{councilId}/1 ページから MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  meeting: { councilId: number; title: string; heldOn: string },
  municipalityId: string,
): Promise<MeetingData | null> {
  const url = buildDetailUrl(meeting.councilId);
  const html = await fetchPage(url);
  if (!html) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn: meeting.heldOn,
    sourceUrl: url,
    externalId: `izumi_${meeting.councilId}`,
    statements,
  };
}
