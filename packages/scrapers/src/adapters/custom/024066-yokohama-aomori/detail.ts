/**
 * 横浜町議会 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、○ マーカーで発言を分割して
 * ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（想定）:
 *   ○議長（田中太郎君）　それでは、ただいまから会議を開きます。
 *   ○町長（山田一郎君）　お答えいたします。
 *   ○３番（佐藤次郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { YokohamaAomoriDocument } from "./list";
import { detectMeetingType, fetchBinary, normalizeFullWidth } from "./shared";

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

  const era = dateMatch[1]!;
  const eraYearRaw = dateMatch[2]!;
  const eraYear = eraYearRaw === "元" ? 1 : parseInt(eraYearRaw, 10);
  const year = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  const month = parseInt(dateMatch[3]!, 10);
  const day = parseInt(dateMatch[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストと sessionTitle から開催日を抽出する。
 * リンクテキスト例: "１２月１日（月）　本会議１号（開会、提案理由）"
 * sessionTitle 例: "第4回定例会（12月1日（月）から12月2日（火））"
 *
 * yearHeading から年を取得し、リンクテキストの月日と組み合わせる。
 */
export function extractHeldOnFromLinkText(
  linkText: string,
  yearHeading: string,
): string | null {
  const normalizedLink = normalizeFullWidth(linkText);

  // 冒頭の「MM月DD日」を抽出
  const mdMatch = normalizedLink.match(/^(\d{1,2})月(\d{1,2})日/);
  if (!mdMatch) return null;

  const month = parseInt(mdMatch[1]!, 10);
  const day = parseInt(mdMatch[2]!, 10);

  // yearHeading から年を取得
  const normalizedHeading = normalizeFullWidth(yearHeading);

  const reiwaMatch = normalizedHeading.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + eraYear;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const heiseiMatch = normalizedHeading.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    const year = 1988 + eraYear;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
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
      `[024066-yokohama-aomori] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  doc: YokohamaAomoriDocument,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const text = await fetchPdfText(doc.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  // heldOn: まず PDF テキストから抽出、失敗した場合はリンクテキストから補完
  let heldOn = extractHeldOn(text);
  if (!heldOn) {
    heldOn = extractHeldOnFromLinkText(doc.linkText, doc.yearHeading);
  }
  if (!heldOn) return null;

  // PDF URL のファイル名（タイムスタンプ部分）を externalId として使用
  const fileNameMatch = doc.pdfUrl.match(/\/([^/]+)\.pdf(?:\?.*)?$/i);
  const fileName = fileNameMatch?.[1] ?? null;
  const externalId = fileName ? `yokohama-aomori_${fileName}` : null;

  // タイトル: sessionTitle + " " + linkText
  const title = `${doc.sessionTitle} ${doc.linkText}`;

  return {
    municipalityCode,
    title,
    meetingType: detectMeetingType(doc.sessionTitle),
    heldOn,
    sourceUrl: doc.pageUrl,
    externalId,
    statements,
  };
}
