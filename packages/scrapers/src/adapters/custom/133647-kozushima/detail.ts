/**
 * 神津島村議会 — detail フェーズ
 *
 * 個別ページから PDF URL を取得し、PDF をダウンロードしてテキストを抽出する。
 * ○ マーカーで発言を分割し ParsedStatement 配列を生成する。
 *
 * 発言フォーマット（PDF 内）:
 *   ○議長（山田太郎君）　ただいまから会議を開きます。
 *   ○村長（佐藤花子君）　お答えいたします。
 *   ○１番（鈴木一郎君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { KozushimaMeeting } from "./list";
import { detectMeetingType, fetchBinary, fetchPage } from "./shared";

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
  "課長補佐",
  "副参事",
  "参事",
  "副部長",
  "部長",
  "副課長",
  "課長",
  "係長",
  "主幹",
  "主査",
  "議員",
  "委員",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "村長",
  "副村長",
  "教育長",
  "副教育長",
  "事務局長",
  "局長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "課長補佐",
  "参事",
  "副参事",
  "係長",
  "主幹",
  "主査",
]);

/**
 * ○ マーカー付きの発言ヘッダーから発言者情報を抽出する。
 *
 * 対応パターン:
 *   ○議長（山田太郎君）　→ role=議長, name=山田太郎
 *   ○村長（佐藤花子君）　→ role=村長, name=佐藤花子
 *   ○１番（鈴木一郎君）　→ role=議員, name=鈴木一郎
 *   ○総務課長（田中次郎君）→ role=課長, name=田中次郎
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

    // 番号付き議員: ○１番（鈴木一郎君）
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
 * PDF から抽出したテキストを ParsedStatement 配列に変換する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // ◎ は議事項目見出し → スキップ
    if (/^[◎]/.test(trimmed)) continue;

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
 * 個別ページから PDF URL を抽出する。
 */
export function parsePdfUrl(html: string): string | null {
  const pdfPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>/gi;
  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    if (href.includes("vill.kouzushima.tokyo.jp/images/")) {
      return href;
    }
    // 相対パスの場合
    if (href.startsWith("/images/")) {
      return `https://www.vill.kouzushima.tokyo.jp${href}`;
    }
  }
  return null;
}

/**
 * タイトルから開催日を推定する。
 *
 * WordPress の投稿 URL パターン `/{YYYY-MMDD}/` から日付を抽出する。
 * e.g., "https://www.vill.kouzushima.tokyo.jp/2024-1119/" → "2024-11-19"
 */
export function parseDateFromUrl(pageUrl: string): string | null {
  const match = pageUrl.match(/\/(\d{4})-(\d{2})(\d{2})\/$/);
  if (!match) return null;

  const year = match[1]!;
  const month = match[2]!;
  const day = match[3]!;
  return `${year}-${month}-${day}`;
}

/**
 * PDF URL から externalId を生成する。
 */
function extractExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `kozushima_${match[1]}`;
}

/**
 * PDF をダウンロードしてテキストを取得する。
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
      `[133647-kozushima] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 個別ページにアクセスして PDF URL を取得し、PDF から MeetingData を生成する。
 */
export async function fetchMeetingData(
  meeting: KozushimaMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const html = await fetchPage(meeting.pageUrl);
  if (!html) return null;

  const pdfUrl = parsePdfUrl(html);
  if (!pdfUrl) return null;

  const text = await fetchPdfText(pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const heldOn = parseDateFromUrl(meeting.pageUrl);
  if (!heldOn) return null;

  const externalId = extractExternalId(pdfUrl);

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.title),
    heldOn,
    sourceUrl: pdfUrl,
    externalId,
    statements,
  };
}
