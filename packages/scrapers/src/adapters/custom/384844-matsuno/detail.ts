/**
 * 松野町議会（愛媛県） — detail フェーズ
 *
 * list フェーズで収集した PDF URL をダウンロードし、
 * テキストを抽出して ParsedStatement 配列を生成する。
 *
 * PDF の構造:
 *   2カラムレイアウト:
 *   - 左カラム（x < SPEAKER_COL_MAX_X): 発言者の役職・名前（各1文字が別要素）
 *   - 右カラム（x >= CONTENT_COL_MIN_X): 発言内容テキスト
 *
 * 発言者の検出:
 *   同一 y 座標に、複数の短い文字列が小さい x 値（< 170）で並んでいるとき、
 *   それらを結合して発言者情報とする。
 *   例: x=78:'議', x=155:'長' → '議長'
 *       x=78:'坂', x=104:'本', x=129:'町', x=155:'長' → '坂本町長'
 *       x=78:'４', x=104:'番', x=129:'山', x=155:'田' → '４番山田'（議員4番）
 */

import { createHash } from "node:crypto";
import { getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { fetchBinary } from "./shared";

export interface MatsunoDetailParams {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: string;
}

/** 発言者カラムの最大X座標（これ未満が発言者カラム） */
const SPEAKER_COL_MAX_X = 170;

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "副町長",
  "副教育長",
  "議長",
  "町長",
  "教育長",
  "事務局長",
  "局長",
  "副部長",
  "次長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "主事",
  "議員",
  "委員",
] as const;

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "町長",
  "副町長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "副部長",
  "次長",
  "部長",
  "副課長",
  "課長",
  "室長",
  "係長",
  "参事",
  "主幹",
  "主査",
  "補佐",
  "主事",
]);

/** 発言者情報 */
interface SpeakerInfo {
  /** 役職（議長、町長、議員など） */
  role: string | null;
  /** 姓名（例: 坂本、山田）または番号名（例: ４番山田） */
  name: string | null;
}

/**
 * 発言者テキスト（例: "議長", "坂本町長", "４番山田"）を
 * 役職と名前に分解する。
 */
export function parseSpeakerText(speakerText: string): SpeakerInfo {
  // "番" パターン: X番NAME（議員）
  const memberMatch = speakerText.match(/^([\d０-９]+番)(.+)$/);
  if (memberMatch) {
    return { role: "議員", name: memberMatch[2] ?? null };
  }

  // 役職マッチ（長い方から）
  for (const suffix of ROLE_SUFFIXES) {
    if (speakerText.endsWith(suffix)) {
      const name =
        speakerText.length > suffix.length
          ? speakerText.slice(0, -suffix.length)
          : null;
      return { role: suffix, name: name || null };
    }
  }

  // マッチしない場合はそのまま名前として扱う
  return { role: null, name: speakerText || null };
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

type PdfTextItem = {
  str: string;
  x: number;
  y: number;
};

/**
 * PDF の1ページ分のテキストアイテムから発言を抽出する。
 *
 * アルゴリズム:
 * 1. アイテムを y 座標でグループ化（同じ y = 同じ行）
 * 2. 各行で:
 *    - x < SPEAKER_COL_MAX_X かつ 文字列が短い（≤ 4 文字）アイテム → 発言者候補
 *    - それ以外 → 発言内容
 * 3. 発言者候補が存在する行は新しい発言の開始
 * 4. 発言者候補がない行は前の発言の継続
 */
export function parseStatementsFromItems(
  items: PdfTextItem[],
): ParsedStatement[] {
  if (items.length === 0) return [];

  // y 座標でグループ化（小数を整数に丸める）
  const rowMap = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = Math.round(item.y);
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y)!.push(item);
  }

  // y 降順（上から下へ）にソート
  const sortedRows = [...rowMap.entries()].sort((a, b) => b[0] - a[0]);

  // 各行を分析して発言者と内容を収集
  interface RawBlock {
    speakerText: string | null;
    contentLines: string[];
  }

  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;

  for (const [, rowItems] of sortedRows) {
    // 行内アイテムを x 昇順にソート
    const sorted = rowItems.slice().sort((a, b) => a.x - b.x);

    // 発言者カラムのアイテム: x < SPEAKER_COL_MAX_X かつ 短い文字列（≤ 4 文字）
    const speakerItems = sorted.filter(
      (i) => i.x < SPEAKER_COL_MAX_X && i.str.trim().length <= 4,
    );

    // 発言内容カラムのアイテム: それ以外
    const contentItems = sorted.filter(
      (i) => !(i.x < SPEAKER_COL_MAX_X && i.str.trim().length <= 4),
    );

    // 発言者テキストを結合
    const speakerText = speakerItems.length > 0
      ? speakerItems.map((i) => i.str.trim()).join("")
      : null;

    // 内容テキストを結合（対話マーカー「XXX」パターンはスキップ）
    const contentText = contentItems
      .map((i) => i.str.trim())
      .filter((s) => s && !/^「[^」]{1,20}」$/.test(s))
      .join(" ");

    if (speakerText) {
      // 新しい発言者が登場 → 新しいブロック開始
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        speakerText,
        contentLines: contentText ? [contentText] : [],
      };
    } else if (contentText) {
      // 内容のみ → 現在のブロックに追加
      if (currentBlock) {
        currentBlock.contentLines.push(contentText);
      } else {
        // ブロックがない場合は新規作成（ページの最初の内容行）
        currentBlock = { speakerText: null, contentLines: [contentText] };
      }
    }
  }

  // 最後のブロックを追加
  if (currentBlock) blocks.push(currentBlock);

  // ParsedStatement に変換
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const content = block.contentLines
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!content) continue;

    let speakerRole: string | null = null;
    let speakerName: string | null = null;

    if (block.speakerText) {
      const parsed = parseSpeakerText(block.speakerText);
      speakerRole = parsed.role;
      speakerName = parsed.name;
    }

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
 * PDF バッファから ParsedStatement 配列を生成する。
 */
export async function parsePdf(
  buffer: ArrayBuffer,
): Promise<ParsedStatement[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const numPages = pdf.numPages;

  const allItems: PdfTextItem[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      // TextMarkedContent には str/transform がないので除外
      if (!("str" in item)) continue;
      const textItem = item as { str: string; transform: number[] };
      if (!textItem.str || !textItem.str.trim()) continue;
      allItems.push({
        str: textItem.str,
        x: textItem.transform[4]!,
        y: textItem.transform[5]! + pageNum * 10000, // ページをまたいでも y 順を保持
      });
    }
  }

  return parseStatementsFromItems(allItems);
}

/**
 * detailParams から PDF をダウンロード・テキスト抽出し、MeetingData を組み立てる。
 */
export async function buildMeetingData(
  params: MatsunoDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  // heldOn が解析できない場合は null を返す
  if (!params.heldOn) return null;

  const buffer = await fetchBinary(params.pdfUrl);
  if (!buffer) return null;

  let statements: ParsedStatement[];
  try {
    statements = await parsePdf(buffer);
  } catch (err) {
    console.warn(
      `[matsuno] PDF パース失敗: ${params.pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  if (statements.length === 0) return null;

  // externalId: PDF ファイル名から生成
  const fileName = params.pdfUrl.split("/").pop() ?? "";
  const externalId = `matsuno_${fileName.replace(/\.pdf$/i, "")}`;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.heldOn,
    sourceUrl: params.pdfUrl,
    externalId,
    statements,
  };
}
