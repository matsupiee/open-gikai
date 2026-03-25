/**
 * 信濃町議会 — detail フェーズ
 *
 * PDF/DOC/DOCX ファイルをダウンロードしてテキストを抽出し、
 * ○ マーカーで発言を分割して ParsedStatement 配列を生成する。
 *
 * - PDF: unpdf を使用
 * - DOCX: word/document.xml を ZIP から抽出してテキスト化
 * - DOC: テキスト抽出を試みる（非対応の場合はスキップ）
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ShinanoFile } from "./list";
import { fetchBinary } from "./shared";

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
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎君）　開会いたします。
 *   ○町長（佐藤次郎君）　お答えします。
 *   ○５番（鈴木一郎君）　質問します。
 *   ○総務課長（田中花子君）　ご説明します。
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○５番（近藤正君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ
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
  speakerRole: string | null
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
 * テキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ト書き（登壇等）をスキップ
    if (/^[○◯◎●]\s*[（(].+?(?:登壇|退席|退場|着席)[）)]$/.test(trimmed))
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
 * DOCX バイト列から word/document.xml のテキストを抽出する。
 *
 * DOCX ファイルは PKZIP アーカイブであり、word/document.xml に本文が含まれる。
 * XML タグを除去してプレーンテキストを取得する。
 */
async function extractDocxText(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const bytes = new Uint8Array(buffer);

    // PKZIP ローカルファイルヘッダーを走査して word/document.xml を探す
    // Local file header signature: 0x04034b50
    const PK_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
    let pos = 0;

    while (pos < bytes.length - 30) {
      if (
        bytes[pos] === PK_SIGNATURE[0] &&
        bytes[pos + 1] === PK_SIGNATURE[1] &&
        bytes[pos + 2] === PK_SIGNATURE[2] &&
        bytes[pos + 3] === PK_SIGNATURE[3]
      ) {
        const compressionMethod = bytes[pos + 8]! | (bytes[pos + 9]! << 8);
        const compressedSize =
          bytes[pos + 18]! |
          (bytes[pos + 19]! << 8) |
          (bytes[pos + 20]! << 16) |
          (bytes[pos + 21]! << 24);
        const fileNameLength = bytes[pos + 26]! | (bytes[pos + 27]! << 8);
        const extraFieldLength = bytes[pos + 28]! | (bytes[pos + 29]! << 8);

        const fileNameStart = pos + 30;
        const fileNameBytes = bytes.slice(fileNameStart, fileNameStart + fileNameLength);
        const fileName = new TextDecoder("utf-8").decode(fileNameBytes);

        const dataStart = fileNameStart + fileNameLength + extraFieldLength;

        if (fileName === "word/document.xml") {
          const compressedData = bytes.slice(dataStart, dataStart + compressedSize);

          let xmlBytes: Uint8Array;
          if (compressionMethod === 0) {
            // Store (no compression)
            xmlBytes = compressedData;
          } else if (compressionMethod === 8) {
            // Deflate
            const { inflateRawSync } = await import("node:zlib");
            xmlBytes = new Uint8Array(inflateRawSync(Buffer.from(compressedData)));
          } else {
            console.warn(`[205834-shinano] Unsupported compression method: ${compressionMethod}`);
            return null;
          }

          const xml = new TextDecoder("utf-8").decode(xmlBytes);
          // XML タグを除去し、段落区切りを改行に変換
          const text = xml
            .replace(/<w:p[ >]/g, "\n<w:p ")
            .replace(/<\/w:p>/g, "</w:p>\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/[ \t]+/g, " ")
            .trim();
          return text;
        }

        pos = dataStart + compressedSize;
      } else {
        pos++;
      }
    }

    console.warn(`[205834-shinano] word/document.xml not found in DOCX`);
    return null;
  } catch (err) {
    console.warn(
      `[205834-shinano] DOCX 解析失敗:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * DOC（旧形式）バイト列からテキストを抽出する。
 * DOC は OLE2 バイナリ形式のため完全なパースは困難。
 * テキスト断片をバイト列から直接抽出する簡易実装。
 */
function extractDocText(buffer: ArrayBuffer): string | null {
  try {
    const bytes = new Uint8Array(buffer);
    const decoder = new TextDecoder("utf-16le");
    // UTF-16LE テキストブロックを抽出
    const textParts: string[] = [];
    let i = 0;
    while (i < bytes.length - 1) {
      // ASCII 範囲の印字可能文字シーケンスを抽出
      if (bytes[i]! >= 0x20 && bytes[i]! < 0x7f && bytes[i + 1] === 0x00) {
        let end = i;
        while (
          end + 1 < bytes.length &&
          bytes[end]! >= 0x20 &&
          bytes[end]! < 0x80 &&
          bytes[end + 1] === 0x00
        ) {
          end += 2;
        }
        const chunk = decoder.decode(bytes.slice(i, end));
        if (chunk.length >= 5) {
          textParts.push(chunk);
        }
        i = end;
      } else {
        i++;
      }
    }
    const text = textParts.join("\n").trim();
    return text || null;
  } catch (err) {
    console.warn(
      `[205834-shinano] DOC 解析失敗:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** PDF URL からテキストを取得する */
async function fetchPdfText(pdfUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(pdfUrl);
    if (!buffer) return null;

    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (err) {
    console.warn(
      `[205834-shinano] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** DOCX URL からテキストを取得する */
async function fetchDocxText(docxUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(docxUrl);
    if (!buffer) return null;
    return await extractDocxText(buffer);
  } catch (err) {
    console.warn(
      `[205834-shinano] DOCX 取得失敗: ${docxUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** DOC URL からテキストを取得する */
async function fetchDocText(docUrl: string): Promise<string | null> {
  try {
    const buffer = await fetchBinary(docUrl);
    if (!buffer) return null;
    return extractDocText(buffer);
  } catch (err) {
    console.warn(
      `[205834-shinano] DOC 取得失敗: ${docUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * ファイルをダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  file: ShinanoFile,
  municipalityCode: string
): Promise<MeetingData | null> {
  let text: string | null;

  if (file.fileType === "docx") {
    text = await fetchDocxText(file.fileUrl);
  } else if (file.fileType === "doc") {
    text = await fetchDocText(file.fileUrl);
  } else {
    text = await fetchPdfText(file.fileUrl);
  }

  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  if (!file.heldOn) return null;

  // ファイル URL からファイル名を externalId として利用
  const urlPath = new URL(file.fileUrl).pathname;
  const fileName =
    urlPath
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/\.(pdf|docx?|doc)$/i, "") ?? null;
  const externalId = fileName ? `shinano_${decodeURIComponent(fileName)}` : null;

  return {
    municipalityCode,
    title: file.title,
    meetingType: file.meetingType,
    heldOn: file.heldOn,
    sourceUrl: file.fileUrl,
    externalId,
    statements,
  };
}
