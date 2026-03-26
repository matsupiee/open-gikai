/**
 * 蔵王町議会（宮城県）会議録 — detail フェーズ
 *
 * PDF 公開（令和7年以降）と HTML フレームセット公開（平成23年〜令和6年）の両方に対応。
 *
 * 発言フォーマット:
 *   ○議長（佐藤長成君）　ただいまから会議を開きます。
 *   ○町長（村上英人君）　お答えいたします。
 *   ○１番（平間徹也君）　質問いたします。
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "../../../utils/pdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { ZaoMeeting } from "./list";
import { detectMeetingType, fetchBinary, fetchShiftJisPage } from "./shared";

// 役職サフィックス（長いものを先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "副委員長",
  "委員長",
  "副議長",
  "教育長",
  "副町長",
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
 *   ○議長（佐藤長成君）　→ role=議長, name=佐藤長成
 *   ○町長（村上英人君）　→ role=町長, name=村上英人
 *   ○１番（平間徹也君）  → role=議員, name=平間徹也
 *   ○総務課長（鈴木賢君）→ role=課長, name=鈴木賢
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

    // 番号付き議員: ○1番（平間徹也君） / ○１番（平間徹也君）
    if (/^[\d０-９]+番$/.test(rolePart)) {
      return { speakerName: rawName, speakerRole: "議員", content };
    }

    // 役職マッチ（完全一致または末尾一致）
    for (const suffix of ROLE_SUFFIXES) {
      if (rolePart === suffix || rolePart.endsWith(suffix)) {
        return { speakerName: rawName, speakerRole: suffix, content };
      }
    }

    return { speakerName: rawName, speakerRole: rolePart || null, content };
  }

  // カッコパターンに合致しない場合: スペース区切りでヘッダーを推定
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
  )
    return "remark";
  for (const role of ANSWER_ROLES) {
    if (speakerRole.endsWith(role)) return "answer";
  }
  return "question";
}

/**
 * ○ マーカーで区切られたテキストを ParsedStatement 配列に変換する。
 * PDF から抽出したテキストと HTML のプレーンテキスト両方に対応。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const blocks = text.split(/(?=[○◯◎●])/);
  const statements: ParsedStatement[] = [];
  let offset = 0;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || !/^[○◯◎●]/.test(trimmed)) continue;

    // 登壇・退席などのト書きをスキップ
    if (/^[○◯◎●].*[（(](?:登壇|退席|退場|着席)[）)]\s*$/.test(trimmed))
      continue;

    // 〔〕で囲まれた行（「異議なし」など）をスキップ
    if (/^〔.+〕$/.test(trimmed)) continue;

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
 * HTML ページから発言テキストを抽出してプレーンテキストに変換する。
 * Shift_JIS デコード済みの HTML を受け取る。
 */
export function extractHtmlText(html: string): string {
  // <script> <style> を除去
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // <br> を改行に変換
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // 残りの HTML タグを除去
  text = text.replace(/<[^>]+>/g, "");

  // HTML エンティティをデコード
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

  return text;
}

/**
 * main.html（フレームセット）から本体 .htm の URL を取得する。
 */
export function extractHtmUrl(mainHtml: string, mainUrl: string): string | null {
  // <frame src="*.htm"> または <frame src="*main.html"> から本体 URL を取得
  const frameMatch = mainHtml.match(
    /<frame[^>]+src="([^"]*\.htm)"[^>]*>/i,
  );
  if (!frameMatch) return null;

  const href = frameMatch[1]!;
  if (href.startsWith("http")) return href;

  // ベース URL から相対パスを解決
  const base = mainUrl.replace(/[^/]+$/, "");
  return `${base}${href}`;
}

/**
 * PDF URL からテキストを抽出する。
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
      `[043010-zao] PDF テキスト抽出失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 会議録エントリから MeetingData を組み立てる。
 * PDF 公開と HTML フレームセット公開の両形式に対応。
 */
export async function fetchMeetingData(
  meeting: ZaoMeeting,
  municipalityCode: string,
): Promise<MeetingData | null> {
  if (meeting.type === "pdf") {
    const text = await fetchPdfText(meeting.pdfUrl);
    if (!text) return null;

    const statements = parseStatements(text);
    if (statements.length === 0) return null;

    const urlPath = new URL(meeting.pdfUrl).pathname;
    const fileName = urlPath.split("/").pop()?.replace(/\.pdf$/i, "") ?? null;
    const externalId = fileName ? `zao_${fileName}` : null;

    return {
      municipalityCode,
      title: meeting.title,
      meetingType: detectMeetingType(meeting.sessionTitle),
      heldOn: meeting.heldOn,
      sourceUrl: meeting.pdfUrl,
      externalId,
      statements,
    };
  } else {
    // HTML フレームセット公開
    if (!meeting.heldOn) return null;

    const mainHtml = await fetchShiftJisPage(meeting.mainUrl);
    if (!mainHtml) return null;

    const htmUrl = extractHtmUrl(mainHtml, meeting.mainUrl);
    if (!htmUrl) return null;

    const html = await fetchShiftJisPage(htmUrl);
    if (!html) return null;

    const text = extractHtmlText(html);
    const statements = parseStatements(text);
    if (statements.length === 0) return null;

    // URL からディレクトリ名を externalId として利用
    const urlPath = new URL(meeting.mainUrl).pathname;
    const dirName =
      urlPath.split("/").filter(Boolean).slice(-2, -1)[0] ?? null;
    const externalId = dirName ? `zao_${dirName}` : null;

    return {
      municipalityCode,
      title: meeting.title,
      meetingType: detectMeetingType(meeting.title),
      heldOn: meeting.heldOn,
      sourceUrl: meeting.mainUrl,
      externalId,
      statements,
    };
  }
}
