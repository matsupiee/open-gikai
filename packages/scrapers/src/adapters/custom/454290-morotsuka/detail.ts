/**
 * 諸塚村議会 — detail フェーズ
 *
 * 議会だより PDF をダウンロードしてテキストを抽出し、
 * Ⱗ（U+2C27）/Ⱘ（U+2C28）マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 議会だよりは広報紙形式（要約）であり、逐語記録ではない。
 *
 * PDF テキストの発言フォーマット:
 *   {話者名（文字間スペースあり）} Ⱗ {質問内容}
 *   {話者名（文字間スペースあり）} Ⱘ {答弁内容}
 *
 * 例:
 *   甲 斐 弘 昭 議 員 Ⱗ 今後の本村自治公民館活動の在り方...
 *   竹 内 教 育 長 Ⱘ 令和四年十一月に...
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { MorotsukaMeeting } from "./list";
import {
  convertJapaneseEra,
  detectMeetingType,
  extractExternalId,
  fetchBinary,
} from "./shared";

/** 質問マーカー (U+2C27 Ⱗ) */
const Q_MARKER = "\u2C27";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副村長",
  "村長",
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
  "参事",
  "主幹",
  "主査",
  "補佐",
  "議員",
  "委員会",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "局長",
  "事務局長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
]);

/**
 * 話者テキストから名前と役職を抽出する。
 *
 * 話者テキスト例: "甲 斐 弘 昭 議 員" / "竹 内 教 育 長" / "藤 﨑 村 長"
 * 文字間スペースを除去してから役職を特定する。
 */
export function parseSpeakerText(rawSpeaker: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  // 文字間のスペースを除去（日本語文字の間のスペースのみ対象）
  const normalized = rawSpeaker.replace(/\s+/g, "").trim();
  if (!normalized) return { speakerName: null, speakerRole: null };

  // 役職サフィックスにマッチするか試みる
  for (const suffix of ROLE_SUFFIXES) {
    if (normalized === suffix || normalized.endsWith(suffix)) {
      const name =
        normalized.length > suffix.length
          ? normalized.slice(0, normalized.length - suffix.length)
          : null;
      return { speakerName: name || null, speakerRole: suffix };
    }
  }

  return { speakerName: normalized || null, speakerRole: null };
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
 * マーカー直前の話者テキストを抽出する。
 *
 * マーカー（Ⱗ/Ⱘ）の直前にある話者名+役職を取得する。
 * 話者テキストは「名前 役職」の形式で文字間にスペースがある。
 *
 * パターン例:
 *   "...たい。\n 甲 斐 弘 昭 議 員 " → "甲 斐 弘 昭 議 員"
 *   "...いきたい。\n 竹 内 教 育 長 " → "竹 内 教 育 長"
 *
 * 役職サフィックスで終わる文字列を探して返す。
 * PDF テキストでは文字間にスペースが挿入されているため、
 * スペースなし版と1文字ごとスペース区切り版の両方で検索する。
 */
export function extractSpeakerBeforeMarker(textBeforeMarker: string): string {
  const trimmed = textBeforeMarker.trimEnd();

  // 末尾から役職サフィックスを探す
  // PDF テキストでは "議 員" のようにスペースが入るため、両方検索する
  for (const suffix of ROLE_SUFFIXES) {
    // スペースあり版: "議 員", "教 育 長", etc.
    const spacedSuffix = suffix.split("").join(" ");
    // まず通常版（スペースなし）で検索
    for (const searchSuffix of [spacedSuffix, suffix]) {
      const lastIdx = trimmed.lastIndexOf(searchSuffix);
      if (lastIdx < 0) continue;

      // suffix の直後に何もない（または空白のみ）ことを確認
      const afterSuffix = trimmed.slice(lastIdx + searchSuffix.length).trim();
      if (afterSuffix !== "") continue;

      // suffix が見つかった位置から前に遡って話者テキスト（名前+役職）を取得
      const beforeSuffix = trimmed.slice(0, lastIdx);

      // 最後の文末マーカーを探す（。、！、？、改行）
      const sentenceEndMatch = beforeSuffix.match(/[。！？\n](?=[^。！？\n]*$)/);
      const start = sentenceEndMatch
        ? beforeSuffix.lastIndexOf(sentenceEndMatch[0]) + 1
        : 0;

      const candidate = trimmed.slice(start, lastIdx + searchSuffix.length).trim();
      if (candidate) return candidate;
    }
  }

  // フォールバック: 末尾 50 文字を返す
  return trimmed.slice(-50).trim();
}

/**
 * PDF テキストを ParsedStatement 配列に変換する。
 *
 * Ⱗ（質問）と Ⱘ（答弁）マーカーで分割し、各マーカーの前に話者、後に内容が続く。
 * 内容は次のマーカーが現れるまでのテキスト。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  // Ⱗ と Ⱘ で分割し、各グループの処理を行う
  const markerRegex = /([ⱗⱘ\u2C27\u2C28])/g;
  const parts = text.split(markerRegex);
  // parts[0] = text before first marker (preamble)
  // parts[1] = first marker
  // parts[2] = text after first marker (content until next marker)
  // parts[3] = second marker
  // ...

  let prevBlockText = parts[0] ?? "";

  for (let i = 1; i < parts.length; i += 2) {
    const marker = parts[i]!;
    const contentBlock = parts[i + 1] ?? "";

    // マーカー直前のブロックから話者テキストを取得
    const speakerRaw = extractSpeakerBeforeMarker(prevBlockText);
    const { speakerName, speakerRole } = parseSpeakerText(speakerRaw);

    // マーカーの種類で質問/答弁を判定
    const isQuestion = marker === Q_MARKER || marker === "\u2C27";

    // コンテンツブロックから次の話者部分（次のマーカー前の話者テキスト）を除去
    // コンテンツは次の話者名が出てくるまで
    // 話者名は役職サフィックスで終わり、その後に次のマーカーが来る
    // → contentBlock の末尾部分が次の話者テキストなので、
    //    次のループで prevBlockText として使われる
    const content = normalizeContent(contentBlock);

    if (content) {
      const contentHash = createHash("sha256").update(content).digest("hex");
      const startOffset = offset;
      const endOffset = offset + content.length;

      // isQuestion/isAnswer は marker で決まるが、役職でも上書きする
      const kind = speakerRole
        ? classifyKind(speakerRole)
        : isQuestion
          ? "question"
          : "answer";

      statements.push({
        kind,
        speakerName,
        speakerRole,
        content,
        contentHash,
        startOffset,
        endOffset,
      });
      offset = endOffset + 1;
    }

    prevBlockText = contentBlock;
  }

  return statements;
}

/**
 * コンテンツブロックをクリーンアップする。
 * - 余分なスペース・改行を除去
 * - 次の話者テキスト（役職サフィックスで終わる末尾部分）を除去
 */
function normalizeContent(raw: string): string {
  // 先頭のスペースを除去
  let content = raw.trimStart();

  // 末尾の話者テキストを除去
  // 話者テキストは「名前+役職」の形式で役職サフィックスで終わる
  for (const suffix of ROLE_SUFFIXES) {
    const lastIdx = content.lastIndexOf(suffix);
    if (lastIdx < 0) continue;

    // suffix の後には次のマーカーが来るはず → suffix 以降は除去候補
    // ただし、suffix が文章の一部である可能性もある
    // → suffix の後に何もない（またはスペースのみ）場合のみ除去
    const afterSuffix = content.slice(lastIdx + suffix.length).trim();
    if (afterSuffix === "") {
      content = content.slice(0, lastIdx).trimEnd();
      break;
    }
  }

  // 複数スペース/改行を1スペースに正規化
  return content.replace(/\s+/g, " ").trim();
}

/**
 * PDF テキストから開催日を推測する。
 * フォールバック: リストページから取得した年月で月初日を返す。
 */
export function parseDateFromPdfText(
  text: string,
  meetingYear: number,
  meetingMonth: number,
): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );

  // 「令和/平成N年N月N日」パターン
  const dateMatch = normalized.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (dateMatch) {
    const year = convertJapaneseEra(dateMatch[1]!, dateMatch[2]!);
    if (!year) return null;
    const month = parseInt(dateMatch[3]!, 10);
    const day = parseInt(dateMatch[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // フォールバック: 月初日
  return `${meetingYear}-${String(meetingMonth).padStart(2, "0")}-01`;
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
      `[454290-morotsuka] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: MorotsukaMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn =
    parseDateFromPdfText(text, meeting.year, meeting.month) ??
    `${meeting.year}-${String(meeting.month).padStart(2, "0")}-01`;

  const externalId = extractExternalId(meeting.pdfUrl);

  return {
    municipalityCode,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
