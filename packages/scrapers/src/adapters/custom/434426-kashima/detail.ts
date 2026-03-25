/**
 * 嘉島町議会 -- detail フェーズ
 *
 * 詳細ページ（/q/aview/282/{id}.html）から PDF ダウンロードリンクを抽出し、
 * PDF テキストを解析して ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF から抽出）:
 *   ○議長（○○○○君）　ただいまから会議を開きます。
 *   ○町長（○○○○君）　お答えいたします。
 *   ○３番（○○○○君）　質問いたします。
 *   ○総務課長（○○○○君）　ご報告いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { BASE_ORIGIN, fetchBinary, fetchPage } from "./shared";

export interface KashimaDetailParams {
  articleId: string;
  title: string;
  detailUrl: string;
  publishedDate: string;
  meetingType: string;
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
  "副部長",
  "部長",
  "副課長",
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
 *   ○議長（山田太郎君）　→ role=議長, name=山田太郎
 *   ○町長（鈴木一郎君）　→ role=町長, name=鈴木一郎
 *   ○３番（田中次郎君）　→ role=議員, name=田中次郎
 *   ○総務課長（高橋三郎君）→ role=課長, name=高橋三郎
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  const stripped = text.replace(/^[○◯◎●]\s*/, "");

  // パターン: role（name + 君|様|議員）content
  const match = stripped.match(
    /^(.+?)[（(](.+?)(?:君|様|議員)[）)]\s*([\s\S]*)/,
  );
  if (match) {
    const rolePart = match[1]!.trim();
    const rawName = match[2]!.replace(/[\s　]+/g, "").trim();
    const content = match[3]!.trim();

    // 番号付き議員: ○３番（田中次郎君）
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
 * 詳細ページ HTML から PDF ダウンロード URL を抽出する。
 * `/dl?q=` で始まるリンクを全件抽出する。
 */
export function parsePdfLinks(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const pattern = /href="(\/dl\?q=[^"]+\.pdf)"/gi;
  for (const match of html.matchAll(pattern)) {
    const path = match[1]!;
    const fullUrl = `${BASE_ORIGIN}${path}`;
    if (seen.has(fullUrl)) continue;
    seen.add(fullUrl);
    urls.push(fullUrl);
  }

  return urls;
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
      `[434426-kashima] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * detailParams から MeetingData を組み立てる。
 * 詳細ページにアクセスして PDF URL を取得し、PDF テキストを抽出する。
 * 複数 PDF がある場合は最初の PDF を使用する。
 */
export async function buildMeetingData(
  params: KashimaDetailParams,
  municipalityCode: string,
): Promise<MeetingData | null> {
  const detailHtml = await fetchPage(params.detailUrl);
  if (!detailHtml) return null;

  const pdfUrls = parsePdfLinks(detailHtml);
  if (pdfUrls.length === 0) return null;

  // 全 PDF からテキストを結合する（複数 PDF が含まれる場合）
  const allStatements: ParsedStatement[] = [];
  let globalOffset = 0;

  for (const pdfUrl of pdfUrls) {
    const text = await fetchPdfText(pdfUrl);
    if (!text) continue;

    const stmts = parseStatements(text);
    for (const stmt of stmts) {
      allStatements.push({
        ...stmt,
        startOffset: globalOffset + stmt.startOffset,
        endOffset: globalOffset + stmt.endOffset,
      });
    }
    if (stmts.length > 0) {
      const last = stmts[stmts.length - 1]!;
      globalOffset += last.endOffset + 1;
    }
  }

  if (allStatements.length === 0) return null;

  return {
    municipalityCode,
    title: params.title,
    meetingType: params.meetingType,
    heldOn: params.publishedDate,
    sourceUrl: params.detailUrl,
    externalId: `kashima_${params.articleId}`,
    statements: allStatements,
  };
}
