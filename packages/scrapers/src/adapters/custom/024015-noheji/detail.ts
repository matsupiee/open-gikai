/**
 * 野辺地町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * PDF リンクは /download_file/view/{fileID}/{pageID} → 303 リダイレクト → 実体 PDF。
 *
 * 発言フォーマット（想定）:
 *   ○議長（田中太郎君）　それでは、ただいまから会議を開きます。
 *   ○町長（山田一郎君）　お答えいたします。
 *   ○３番（佐藤次郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { NohejiDocument } from "./list";
import { detectMeetingType, fetchBinary, parseJapaneseDate, normalizeFullWidth } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
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
 *   ○議長（田中太郎君）　→ role=議長, name=田中太郎
 *   ○町長（山田一郎君）　→ role=町長, name=山田一郎
 *   ○３番（佐藤次郎君）  → role=議員, name=佐藤次郎
 *   ○建設課長（鈴木一君）→ role=課長, name=鈴木一
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員|さん）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員|さん)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（佐藤次郎君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（長い順に照合）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // ○ マーカーはあるがカッコパターンに合致しない場合
  const headerMatch = stripped.match(/^([^\s　]{1,30})[\s　]+([\s\S]*)/);
  if (headerMatch) {
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
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 * statements が空の場合は空配列を返す。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●].*[（(](?:登壇|退席|退場|着席)[）)]\s*$/.test(trimmed))
      continue;

    const normalized = trimmed.replace(/\s+/g, " ");
    const { speakerName, speakerRole, content } = parseSpeaker(normalized);
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

  return statements;
}

/**
 * PDF テキストから開催日を抽出する。
 * 「令和X年X月X日」パターンを探す。
 * 解析できない場合は null を返す。
 */
export function extractHeldOn(text: string): string | null {
  const normalized = normalizeFullWidth(text);
  const dateMatch = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月\s*(\d{1,2})日/);
  if (!dateMatch) return null;
  return parseJapaneseDate(dateMatch[0]);
}

/**
 * PDF URL からテキストを取得する。
 * /download_file/view/{fileID}/{pageID} は 303 リダイレクトで実体 PDF に転送される。
 */
async function fetchPdfText(downloadUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(downloadUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[024015-noheji] PDF 取得失敗: ${downloadUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF リンクテキストから会議の日付を抽出する。
 * 例: "本会議第２号（１２月　９日）【一般質問】"
 *
 * セッションタイトルから年度を取得し、リンクテキストから月・日を補完する。
 */
export function extractHeldOnFromLinkText(
  linkText: string,
  sessionTitle: string,
): string | null {
  const normalizedLink = normalizeFullWidth(linkText);
  const normalizedSession = normalizeFullWidth(sessionTitle);

  // 月・日を抽出: "（12月 9日）" or "（12月9日）"
  const mdMatch = normalizedLink.match(/（(\d{1,2})月\s*(\d{1,2})日）/);
  if (!mdMatch) return null;

  const month = parseInt(mdMatch[1]!, 10);
  const day = parseInt(mdMatch[2]!, 10);

  // セッションタイトルから年を抽出
  // 例: "令和４年第１回３月定例会" → 令和4年 = 2022
  // セッションタイトルの令和X年がそのままカレンダー年として使用できる
  const reiwaMatch = normalizedSession.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + eraYear;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  doc: NohejiDocument,
  municipalityId: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(doc.downloadUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // heldOn: まず PDF テキストから抽出、失敗した場合はリンクテキストから補完
  let heldOn = extractHeldOn(text);
  if (!heldOn) {
    heldOn = extractHeldOnFromLinkText(doc.linkText, doc.sessionTitle);
  }
  if (!heldOn) return null;

  // ダウンロード URL の fileID を externalId として使用
  const fileIdMatch = doc.downloadUrl.match(/\/download_file\/view\/(\d+)\//);
  const fileId = fileIdMatch?.[1] ?? null;
  const externalId = fileId ? `noheji_${fileId}` : null;

  // タイトル: "令和X年第N回M月定例会 本会議第X号"
  const title = `${doc.sessionTitle} ${doc.linkText}`;

  return {
    municipalityId,
    title,
    meetingType: detectMeetingType(doc.sessionTitle),
    heldOn,
    sourceUrl: doc.sessionPageUrl,
    externalId,
    statements,
  };
}
