/**
 * 紀北町議会 -- detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、────区切り線で発言ブロックを分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   ──────────────────────────────────────────
 *   入江康仁議長 ただいまから…
 *   ──────────────────────────────────────────
 *   尾上壽一町長 お答えいたします…
 *   ──────────────────────────────────────────
 *   日程第２ 入江康仁議長 次に、日程第２ 一般質問を行います。
 *   ──────────────────────────────────────────
 *   ８番 樋口泰生議員 質問いたします…
 *
 * 開催日は PDF 本文の冒頭から抽出する。
 * 例: "令和6年3月4日" or "令和6年3月4日（月曜日）"
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary, parseWarekiYear } from "./shared";
import type { KihokuPdfRecord } from "./list";

export interface KihokuDetailParams {
  title: string;
  meetingType: string;
  pdfUrl: string;
  year: number;
  postUrl: string;
}

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
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
  "局長",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "監査委員",
  "議員",
  "委員",
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
  "次長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "理事",
  "政策監",
  "管理者",
  "監査委員",
  "事務局長",
]);

/**
 * 発言ブロックのテキストから発言者情報を抽出する。
 *
 * 対応パターン:
 *   入江康仁議長 ただいまから…     → role=議長, name=入江康仁
 *   尾上壽一町長 お答えいたします… → role=町長, name=尾上壽一
 *   中場副町長 ご説明いたします…   → role=副町長, name=中場
 *   ８番 樋口泰生議員 質問いたします → role=議員, name=樋口泰生
 *   上野隆志事務局長 おはようございます → role=事務局長, name=上野隆志
 *   日程第１ 入江康仁議長 会議録署名… → 日程番号プレフィックスを除去後にパース
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // 「日程第X」等のプレフィックスを除去（全角数字・漢数字も対応）
  let normalized = text.trim().replace(/^(?:日程第[\d０-９一二三四五六七八九十百千]+\s+)+/, "");

  // 最初のスペース（半角・全角）位置を取得
  const spaceIdx = normalized.search(/[\s　]/);
  if (spaceIdx === -1) {
    return { speakerName: null, speakerRole: null, content: normalized };
  }

  const headerCandidate = normalized.slice(0, spaceIdx);
  const rest = normalized.slice(spaceIdx).trim();

  if (!rest) {
    return { speakerName: null, speakerRole: null, content: normalized };
  }

  // パターン1: 「N番」で始まる場合 → 「８番 氏名役職 発言内容」
  if (/^[\d０-９]+番$/.test(headerCandidate)) {
    const spaceIdx2 = rest.search(/[\s　]/);
    if (spaceIdx2 === -1) {
      return { speakerName: null, speakerRole: null, content: normalized };
    }
    const nameRole = rest.slice(0, spaceIdx2);
    const content = rest.slice(spaceIdx2).trim();
    if (!content) {
      return { speakerName: null, speakerRole: null, content: normalized };
    }
    for (const suffix of ROLE_SUFFIXES) {
      if (nameRole.endsWith(suffix)) {
        const name = nameRole.length > suffix.length ? nameRole.slice(0, -suffix.length) : null;
        return { speakerName: name, speakerRole: suffix, content };
      }
    }
    return { speakerName: nameRole, speakerRole: null, content };
  }

  // パターン2: 「氏名役職 発言内容」
  for (const suffix of ROLE_SUFFIXES) {
    if (headerCandidate.endsWith(suffix)) {
      const name = headerCandidate.length > suffix.length
        ? headerCandidate.slice(0, -suffix.length)
        : null;
      return { speakerName: name, speakerRole: suffix, content: rest };
    }
  }

  return { speakerName: null, speakerRole: null, content: normalized };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): "remark" | "question" | "answer" {
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
 * PDF から抽出したテキストの冒頭から開催日を解析する。
 *
 * 例:
 *   "令和6年3月4日（月曜日）" → "2024-03-04"
 *   "令和６年３月４日"        → "2024-03-04"（全角数字も対応）
 *
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseHeldOn(text: string): string | null {
  // 全角数字を半角に変換するユーティリティ
  const toHankaku = (s: string) =>
    s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

  // 全角数字を半角に正規化してからパース
  const normalized = toHankaku(text);

  // 和暦 + 月日パターン（元年・数字両対応）
  const m = normalized.match(
    /([令平昭][和成和]\s*(?:\d+|元)\s*年)\s*(\d+)\s*月\s*(\d+)\s*日/
  );
  if (!m) return null;

  const seirekiYear = parseWarekiYear(m[1]!);
  if (!seirekiYear) return null;

  const month = parseInt(m[2]!, 10);
  const day = parseInt(m[3]!, 10);

  if (isNaN(month) || isNaN(day)) return null;

  return `${seirekiYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 *
 * 紀北町の議事録PDFは ──────...────── (U+2500) の区切り線でブロックを分割し、
 * 各ブロックの先頭に「氏名役職 発言内容」または「N番 氏名役職 発言内容」の形式で
 * 発言者情報が含まれる。
 */
export function parseStatements(text: string): ParsedStatement[] {
  // ──────（U+2500 の連続）で分割
  const blocks = text.split(/─{5,}/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // 複数の改行・スペースを単一スペースに正規化
    const normalized = trimmed.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
    if (!normalized || normalized.length < 5) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
    if (!content || content.length < 5) continue;

    // speakerRole がない場合は発言者不明ブロック（本文のみ）として扱う
    // 発言者がいないブロック（ページ番号、時刻表示等）は短すぎるため弾かれる

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

  return statements;
}

/**
 * PDF URL からテキストを取得する。
 */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[245437-kihoku] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function buildMeetingData(
  params: KihokuDetailParams,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(params.pdfUrl);
  if (!text) return null;

  const heldOn = parseHeldOn(text);
  if (!heldOn) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // externalId: postUrl の末尾 ID + pdfUrl のパス部分をハッシュ化
  const postId = params.postUrl.replace(/\/$/, "").split("/").pop() ?? "";
  const pdfPath = new URL(params.pdfUrl).pathname.split("/").pop() ?? "";
  const externalId = `kihoku_${postId}_${pdfPath}`;

  return {
    municipalityId,
    title: params.title,
    meetingType: params.meetingType,
    heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}

/** KihokuPdfRecord を KihokuDetailParams に変換する型ヘルパー */
export function toDetailParams(record: KihokuPdfRecord): KihokuDetailParams {
  return {
    title: record.title,
    meetingType: record.meetingType,
    pdfUrl: record.pdfUrl,
    year: record.year,
    postUrl: record.postUrl,
  };
}
