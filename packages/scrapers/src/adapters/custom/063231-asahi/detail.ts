/**
 * 朝日町教育委員会 定例会会議録 — detail フェーズ
 *
 * PDF をダウンロードしてテキストを抽出し、
 * 「役職 - 発言内容」のパターンで発言を分割して ParsedStatement 配列を生成する。
 *
 * 発言フォーマット:
 *   教 育 長 - 日程的な事項及び当面の日程について報告
 *   議　　長 - 教育長委任事項の報告について質疑の有無を確認（質疑・意見なし）
 *   課　　長 - 令和6年度小中学校職員及び事務局職員事務分担について報告
 *   3番委員 - 小中学校職員名簿で教員業務支援の空欄があるのはまだ決まっていないからか
 *   主　　幹 - 大谷小学校について現在も探している状況である
 *   補　　佐 - 令和6年度朝日町小学校陸上記録会について報告
 *   指 導 主 事 - 令和6年度中学生海外派遣事業について報告
 *   2番委員 - 学校訪問について、…
 */

import { createHash } from "node:crypto";
import { extractText, getDocumentProxy } from "unpdf";
import type { MeetingData, ParsedStatement } from "../../../utils/types";
import type { AsahiMeeting } from "./list";
import { detectMeetingType, extractExternalIdKey, fetchBinary } from "./shared";

/**
 * 役職ラベル（PDF テキスト抽出後に出現しうるパターン）。
 * スペースが入る場合があるため正規化後にマッチする。
 */
const ROLE_LABELS: { pattern: RegExp; role: string; kind: "remark" | "question" | "answer" }[] = [
  { pattern: /^教\s*育\s*長$/, role: "教育長", kind: "remark" },
  { pattern: /^議\s*長$/, role: "議長", kind: "remark" },
  { pattern: /^副\s*議\s*長$/, role: "副議長", kind: "remark" },
  { pattern: /^課\s*長$/, role: "課長", kind: "answer" },
  { pattern: /^教\s*育\s*文\s*化\s*課\s*長$/, role: "教育文化課長", kind: "answer" },
  { pattern: /^主\s*幹$/, role: "主幹", kind: "answer" },
  { pattern: /^補\s*佐$/, role: "補佐", kind: "answer" },
  { pattern: /^課\s*長\s*補\s*佐/, role: "課長補佐", kind: "answer" },
  { pattern: /^主\s*査$/, role: "主査", kind: "answer" },
  { pattern: /^係\s*長$/, role: "係長", kind: "answer" },
  { pattern: /^生\s*涯\s*学\s*習\s*係\s*長$/, role: "生涯学習係長", kind: "answer" },
  { pattern: /^指\s*導\s*主\s*事$/, role: "指導主事", kind: "answer" },
  { pattern: /^事\s*務\s*局\s*長$/, role: "事務局長", kind: "answer" },
  { pattern: /^事\s*務\s*局\s*次\s*長$/, role: "事務局次長", kind: "answer" },
  { pattern: /^\d+\s*番\s*委\s*員$/, role: "委員", kind: "question" },
];

/**
 * 役職ラベルを正規化して検出する。
 * e.g., "教 育 長" → { role: "教育長", kind: "remark" }
 */
export function detectRole(label: string): {
  role: string;
  kind: "remark" | "question" | "answer";
} | null {
  const trimmed = label.trim();
  for (const { pattern, role, kind } of ROLE_LABELS) {
    if (pattern.test(trimmed)) {
      return { role, kind };
    }
  }
  return null;
}

/**
 * PDF から抽出したテキストを「役職 - 発言内容」パターンで分割する。
 *
 * パース対象は「５　会　　議」以降の部分。
 * 各行を「{役職} - {内容}」でマッチし、ParsedStatement を生成する。
 */
export function parseStatements(text: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];

  // 「５　会　　議」「5　会　議」「⑤」等のセクション開始を探す
  const meetingSectionStart = text.search(/[５5]\s*会\s*議|①\s*開\s*会/);
  const targetText = meetingSectionStart >= 0 ? text.slice(meetingSectionStart) : text;

  // 行ごとに分割
  const lines = targetText.split("\n");

  // 「役職 - 内容」パターン
  // 役職部分は漢字・数字・スペースで構成され、「 - 」で区切られる
  const statementPattern = /^(.+?)\s*[-－–]\s+(.+)$/;

  let currentRole: { role: string; kind: "remark" | "question" | "answer" } | null = null;
  let currentContent = "";
  let offset = 0;

  function flushStatement() {
    if (currentRole && currentContent) {
      const content = currentContent.trim();
      if (content) {
        const contentHash = createHash("sha256").update(content).digest("hex");
        const startOffset = offset;
        const endOffset = offset + content.length;
        statements.push({
          kind: currentRole.kind,
          speakerName: null,
          speakerRole: currentRole.role,
          content,
          contentHash,
          startOffset,
          endOffset,
        });
        offset = endOffset + 1;
      }
    }
    currentRole = null;
    currentContent = "";
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 閉会以降はスキップ
    if (/閉\s*会/.test(trimmed) && /宣言|閉会$/.test(trimmed)) {
      flushStatement();
      break;
    }

    // 署名欄等はスキップ
    if (/^(会\s*議\s*録\s*署\s*名|教\s*育\s*長|調\s*整\s*職\s*員)/.test(trimmed) && !trimmed.includes("-") && !trimmed.includes("－")) {
      continue;
    }

    const match = trimmed.match(statementPattern);
    if (match) {
      const roleLabel = match[1]!;
      const content = match[2]!;

      const detected = detectRole(roleLabel);
      if (detected) {
        // 前の発言を確定
        flushStatement();
        currentRole = detected;
        currentContent = content;
        continue;
      }
    }

    // 前の発言の継続行
    if (currentRole && currentContent) {
      currentContent += trimmed;
    }
  }

  // 最後の発言を確定
  flushStatement();

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
      `[063231-asahi] PDF 取得失敗: ${pdfUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF をダウンロード・テキスト抽出し、MeetingData に変換する。
 */
export async function fetchMeetingData(
  meeting: AsahiMeeting,
  municipalityId: string
): Promise<MeetingData | null> {
  const text = await fetchPdfText(meeting.pdfUrl);
  if (!text) return null;

  const statements = parseStatements(text);
  if (statements.length === 0) return null;

  const idKey = extractExternalIdKey(meeting.pdfUrl);
  const externalId = idKey ? `asahi_${idKey}` : null;

  return {
    municipalityId,
    title: meeting.title,
    meetingType: detectMeetingType(meeting.sessionName),
    heldOn: meeting.heldOn,
    sourceUrl: meeting.pdfUrl,
    externalId,
    statements,
  };
}
