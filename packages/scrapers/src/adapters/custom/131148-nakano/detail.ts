/**
 * 中野区議会 議事録検索システム — detail フェーズ
 *
 * view.html?gijiroku_id={id} から議事録本文を取得し、MeetingData に変換する。
 *
 * 本会議の発言形式:
 *   ○役職（氏名）　本文...
 *   例: ○議長（森たかゆき）　日程第１...
 *       ○２９番（高橋かずちか）　質問いたします。
 *
 * 委員会の発言形式:
 *   発言者名（役職含む）が単独行に記載、次の行から本文
 *   例: 委員長
 *       　定足数に達しましたので...
 *
 * エンコーディング: UTF-8
 */

import { createHash } from "node:crypto";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import { buildDetailUrl, detectMeetingType, fetchPage } from "./shared";

// 役職サフィックス（長い方を先に置いて誤マッチを防ぐ）
const ROLE_SUFFIXES = [
  "事務局長",
  "副委員長",
  "副議長",
  "副区長",
  "教育長",
  "委員長",
  "部長",
  "課長",
  "係長",
  "室長",
  "局長",
  "参事",
  "次長",
  "理事",
  "主任",
  "主査",
  "補佐",
  "区長",
  "委員",
  "書記",
];

// 行政側の役職（答弁者として分類する）
const ANSWER_ROLES = new Set([
  "区長",
  "副区長",
  "教育長",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
  "事務局長",
  "参事",
  "次長",
  "理事",
  "書記",
]);

/**
 * 本会議の発言テキストから話者名・役職・本文を抽出する。
 * フォーマット: "○役職（氏名）　本文テキスト..."
 */
export function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
  content: string;
} {
  // ○役職（氏名）パターン
  const m = text.match(/^○([^（\n]+)（([^）]+)）\s*/);
  if (!m) {
    return { speakerName: null, speakerRole: null, content: text.replace(/^○\s*/, "").trim() };
  }

  const speakerRole = m[1]!.trim();
  const speakerName = m[2]!.trim();
  const content = text.substring(m[0].length).trim();

  return { speakerName, speakerRole, content };
}

/** 役職から発言種別を分類 */
export function classifyKind(speakerRole: string | null): string {
  if (!speakerRole) return "remark";

  // 議席番号（例: "２９番"）→ 質問者
  if (/^[0-9０-９]+番$/.test(speakerRole)) return "question";
  // 議長・委員長 → remark
  if (speakerRole === "議長" || speakerRole.endsWith("議長")) return "remark";
  if (speakerRole.endsWith("委員長")) return "remark";
  // 議員・委員 → question
  if (speakerRole.endsWith("議員") || speakerRole.endsWith("委員"))
    return "question";
  // 行政側役職
  for (const role of ANSWER_ROLES) {
    if (speakerRole === role || speakerRole.endsWith(role)) return "answer";
  }

  return "remark";
}

/**
 * 委員会の発言者行を検出する。
 * 役職サフィックスで終わる短い行を発言者として認識する。
 */
export function detectCommitteeSpeaker(
  line: string,
): { role: string } | null {
  // 役職のみ（委員長、副委員長など）
  if (/^(副?委員長)$/.test(line)) {
    return { role: line };
  }

  // 末尾が役職キーワードで終わるか確認
  const matchingSuffix = ROLE_SUFFIXES.find((s) => line.endsWith(s));
  if (!matchingSuffix) return null;

  return { role: line };
}

/**
 * HTML から発言を抽出する。
 * 本会議と委員会で異なるパターンを使い分ける。
 */
export function parseStatements(html: string, title: string): ParsedStatement[] {
  const isCommittee = title.includes("委員会");
  const contentHtml = extractContentArea(html);
  if (!contentHtml) return [];

  if (isCommittee) {
    return extractCommitteeStatements(contentHtml);
  }
  return extractPlenaryStatements(contentHtml);
}

/**
 * HTML からメインコンテンツ領域を抽出する。
 */
function extractContentArea(html: string): string | null {
  // id="sh" の div を探す（右パネル = 本文領域）
  const shMatch = html.match(/id="sh"[^>]*>([\s\S]*?)$/i);
  if (shMatch) return shMatch[1]!;

  // WordSection1 を探す
  const wsMatch = html.match(/class=WordSection1[^>]*>([\s\S]*?)<\/div>/i);
  if (wsMatch) return wsMatch[1]!;

  // フォールバック: body 全体
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1]! : null;
}

/**
 * 本会議の発言を抽出する。
 * ○ プレフィックスで発言ターンを区切る。
 */
function extractPlenaryStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const text = cleanHtmlText(html);
  const blocks = text.split(/(?=○)/);

  for (const block of blocks) {
    if (!block.startsWith("○")) continue;

    const { speakerName, speakerRole, content } = parseSpeaker(block.trim());
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
 * 委員会の発言を抽出する。
 * 発言者名が単独行に記載され、次の行から本文が続くパターン。
 */
function extractCommitteeStatements(html: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let offset = 0;

  const text = cleanHtmlText(html);
  const lines = text.split("\n");

  let currentRole: string | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ○ で始まる行はメタデータ（出席委員等）なのでスキップ
    if (trimmed.startsWith("○")) continue;

    // 発言者行の検出
    const speaker = trimmed.length <= 30 ? detectCommitteeSpeaker(trimmed) : null;
    if (speaker) {
      // 前の発言を保存
      if (currentRole && currentContent.length > 0) {
        const content = currentContent.join("\n").trim();
        if (content) {
          const contentHash = createHash("sha256").update(content).digest("hex");
          const startOffset = offset;
          const endOffset = offset + content.length;

          statements.push({
            kind: classifyKind(currentRole),
            speakerName: null,
            speakerRole: currentRole,
            content,
            contentHash,
            startOffset,
            endOffset,
          });

          offset = endOffset + 1;
        }
      }

      currentRole = speaker.role;
      currentContent = [];
      continue;
    }

    // 本文行
    if (currentRole) {
      currentContent.push(trimmed);
    }
  }

  // 最後の発言を保存
  if (currentRole && currentContent.length > 0) {
    const content = currentContent.join("\n").trim();
    if (content) {
      const contentHash = createHash("sha256").update(content).digest("hex");
      const startOffset = offset;
      const endOffset = offset + content.length;

      statements.push({
        kind: classifyKind(currentRole),
        speakerName: null,
        speakerRole: currentRole,
        content,
        contentHash,
        startOffset,
        endOffset,
      });
    }
  }

  return statements;
}

/**
 * HTML のテキストをクリーンアップする。
 */
export function cleanHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * ドキュメント Id から発言データを取得する。
 */
export async function fetchDocumentStatements(
  gijirokuId: string,
  title: string,
): Promise<ParsedStatement[] | null> {
  const url = buildDetailUrl(gijirokuId);
  const html = await fetchPage(url);
  if (!html) return null;

  const statements = parseStatements(html, title);
  return statements.length > 0 ? statements : null;
}

/**
 * ドキュメント情報から MeetingData を組み立てる。
 */
export async function fetchMeetingData(
  doc: { gijirokuId: string; title: string; heldOn: string },
  municipalityId: string,
): Promise<MeetingData | null> {
  const statements = await fetchDocumentStatements(doc.gijirokuId, doc.title);
  if (!statements) return null;

  return {
    municipalityId,
    title: doc.title,
    meetingType: detectMeetingType(doc.title),
    heldOn: doc.heldOn,
    sourceUrl: buildDetailUrl(doc.gijirokuId),
    externalId: `nakano_${doc.gijirokuId}`,
    statements,
  };
}
