/**
 * 小鹿野町議会 — detail フェーズ
 *
 * main.html を Shift_JIS でフェッチし、<b> タグで囲まれた発言者と
 * 続くテキストを ParsedStatement 配列に変換する。
 *
 * 発言フォーマット:
 *   <b>議長（氏名）</b>　発言内容...
 *   <b>10番（氏名）</b>　発言内容...
 *   <b>町長（氏名）</b>　発言内容...
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { OganoMeeting } from "./list";
import { detectMeetingType, fetchPage } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "教育長",
  "議長",
  "町長",
  "副部長",
  "副課長",
  "事務局長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "事務局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * <b> タグ内の発言者テキストから役職と氏名を抽出する。
 *
 * 対応パターン:
 *   "議長（鈴木一郎）" -> role=議長, name=鈴木一郎
 *   "10番（山田花子）" -> role=議員, name=山田花子
 *   "町長（田中太郎）" -> role=町長, name=田中太郎
 *   "総務課長（佐藤次郎）" -> role=課長, name=佐藤次郎
 */
export function parseSpeaker(boldText: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const text = boldText.trim();

  // パターン: role（name）
  const match = text.match(/^(.+?)[（(](.+?)[）)]/);
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();

    // 番号付き議員: "10番" / "１０番"
    const normalizedRole = rolePart.replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    );
    if (/^\d+番$/.test(normalizedRole)) {
      return { speakerName: rawName, speakerRole: "議員" };
    }

    // 役職マッチ（完全一致または末尾一致）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null };
  }

  return { speakerName: null, speakerRole: null };
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
 * main.html の HTML を解析して ParsedStatement 配列に変換する。
 *
 * <b>発言者（氏名）</b> に続くテキストを発言内容として抽出する。
 * 各 <b> タグが発言の区切りとなる。
 */
export function parseStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // <script> <style> を除去
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // <br> を改行に変換
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");

  // <b>...</b> のパターンを見つけて発言を分割する
  // 全体を <b>タグ境界で分割
  const parts = cleaned.split(/(<b[^>]*>[\s\S]*?<\/b>)/gi);

  let currentSpeaker: { speakerName: string | null; speakerRole: string | null } | null =
    null;
  let contentBuffer = "";

  const flushStatement = () => {
    if (!currentSpeaker) return;
    // HTML タグを除去してプレーンテキスト化
    const text = contentBuffer
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      const contentHash = createHash("sha256").update(text).digest("hex");
      const startOffset = offset;
      const endOffset = offset + text.length;
      statements.push({
        kind: classifyKind(currentSpeaker.speakerRole),
        speakerName: currentSpeaker.speakerName,
        speakerRole: currentSpeaker.speakerRole,
        content: text,
        contentHash,
        startOffset,
        endOffset,
      });
      offset = endOffset + 1;
    }
    contentBuffer = "";
    currentSpeaker = null;
  };

  for (const part of parts) {
    // <b> タグかチェック
    const boldMatch = part.match(/^<b[^>]*>([\s\S]*?)<\/b>$/i);
    if (boldMatch) {
      const boldContent = boldMatch[1]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim();

      // 発言者パターンかどうか確認（括弧を含む場合）
      if (/[（(]/.test(boldContent)) {
        flushStatement();
        currentSpeaker = parseSpeaker(boldContent);
        contentBuffer = "";
      } else {
        // 発言者でない <b> タグ（強調など）は現在のコンテンツバッファに追加
        contentBuffer += part;
      }
    } else {
      // <b> タグでない部分はバッファに追加
      contentBuffer += part;
    }
  }

  // 最後の発言をフラッシュ
  flushStatement();

  return statements;
}

/**
 * main.html から開催日を抽出する。
 *
 * 本文冒頭付近に "令和7年3月5日" のような日付が現れる。
 */
export function extractHeldOn(html: string): string | null {
  // HTML タグを除去してテキスト化
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // 日付パターン: 令和/平成 + 年 + 月 + 日
  const datePattern = /(?:令和|平成)(元|\d+)年(\d+)月(\d+)日/;
  const match = text.match(datePattern);
  if (!match) return null;

  const eraText = text.includes("令和") ? "令和" : "平成";
  const eraYear = match[1] === "元" ? 1 : parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  let westernYear: number;
  if (eraText === "令和") westernYear = eraYear + 2018;
  else westernYear = eraYear + 1988;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * main.html をフェッチ・パースして MeetingData を返す。
 */
export async function fetchMeetingData(
  meeting: OganoMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const html = await fetchPage(meeting.mainUrl);
  if (!html) return null;

  const statements = parseStatements(html);
  if (statements.length === 0) return null;

  // main.html から日付を抽出できれば使う。できなければ heldOn をそのまま使う
  const extractedDate = extractHeldOn(html);
  const heldOn = extractedDate ?? meeting.heldOn;

  // ファイル名から externalId を生成
  const baseName = meeting.fileName.replace(/\.html$/i, "");
  const externalId = `ogano_${baseName}`;

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.mainUrl,
    externalId,
    statements,
  };
}
