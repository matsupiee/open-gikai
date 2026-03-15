/**
 * kensakusystem.jp — rawText → ParsedStatement 変換
 *
 * kensakusystem の議事録は行頭の ○◎◆ 発言者マーカーで発言が区切られている。
 * 例: ○議長（田中太郎）　発言内容...
 */

import { createHash } from "node:crypto";
import type { ParsedStatement } from "../../utils/types";

/**
 * 行政職員の役職（答弁者として扱う）
 */
const EXECUTIVE_ROLES = new Set([
  "市長",
  "副市長",
  "部長",
  "副部長",
  "課長",
  "副課長",
  "室長",
  "市長室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
]);

/**
 * 議事進行役の役職（一般発言として扱う）
 */
const PRESIDING_ROLES = new Set([
  "議長",
  "副議長",
  "委員長",
  "副委員長",
]);

/**
 * 役職サフィックス一覧（長いものを優先してマッチ）
 */
const ROLE_SUFFIXES = [
  "委員長",
  "副委員長",
  "副議長",
  "市長室長",
  "副市長",
  "副部長",
  "副課長",
  "議長",
  "市長",
  "委員",
  "部長",
  "課長",
  "室長",
  "局長",
  "係長",
  "主任",
  "補佐",
  "主査",
];

function classifyKind(speakerRole: string | null): string {
  if (speakerRole) {
    if (PRESIDING_ROLES.has(speakerRole)) return "remark";
    if (EXECUTIVE_ROLES.has(speakerRole)) return "answer";
  }
  return "question";
}

function parseSpeaker(text: string): {
  speakerName: string | null;
  speakerRole: string | null;
} {
  const match = text.match(/^[○◎◆]([^（　\s]+)(?:（([^）]+)）)?[　\s]?/);
  if (!match) return { speakerName: null, speakerRole: null };

  const nameAndRole = match[1] ?? "";
  const inParen = match[2];

  // NDL パターン: ○役職（氏名）
  if (inParen) {
    return {
      speakerRole: nameAndRole,
      speakerName: inParen.replace(/君$/, ""),
    };
  }

  // NDL パターン: ○氏名君
  if (nameAndRole.endsWith("君")) {
    return {
      speakerRole: null,
      speakerName: nameAndRole.replace(/君$/, ""),
    };
  }

  // 鹿児島パターン: 氏名 + 役職サフィックス
  for (const suffix of ROLE_SUFFIXES) {
    if (nameAndRole.endsWith(suffix) && nameAndRole.length > suffix.length) {
      return {
        speakerRole: suffix,
        speakerName: nameAndRole.slice(0, -suffix.length),
      };
    }
  }

  return {
    speakerRole: null,
    speakerName: nameAndRole,
  };
}

function stripSpeakerPrefix(text: string): string {
  return text.replace(/^[○◎◆][^（　\s]+(?:（[^）]+）)?[　\s]?/, "").trim();
}

/**
 * 行頭の ○◎◆ 発言者マーカーで rawText を発言単位に分割する。
 * 最初の発言者マーカーより前のヘッダー行はスキップする。
 */
function splitRawText(rawText: string): string[] {
  const speakerLinePattern = /^[○◎◆]/;
  const lines = rawText.split("\n");

  const parts: string[] = [];
  let currentLines: string[] = [];
  let foundFirstSpeaker = false;

  for (const line of lines) {
    if (speakerLinePattern.test(line)) {
      if (foundFirstSpeaker && currentLines.length > 0) {
        const part = currentLines.join("\n").trim();
        if (part) parts.push(part);
      }
      currentLines = [line];
      foundFirstSpeaker = true;
    } else if (foundFirstSpeaker) {
      currentLines.push(line);
    }
  }

  if (foundFirstSpeaker && currentLines.length > 0) {
    const part = currentLines.join("\n").trim();
    if (part) parts.push(part);
  }

  return parts.length > 0 ? parts : [rawText.trim()];
}

/**
 * kensakusystem の rawText を ParsedStatement 配列に変換する。
 */
export function toStatements(rawText: string): ParsedStatement[] {
  const parts = splitRawText(rawText);
  const result: ParsedStatement[] = [];
  let offset = 0;

  for (const part of parts) {
    const contentHash = createHash("sha256").update(part).digest("hex");
    const startOffset = offset;
    const endOffset = offset + part.length;

    const { speakerName, speakerRole } = parseSpeaker(part);
    const content = stripSpeakerPrefix(part);
    const kind = classifyKind(speakerRole);

    result.push({
      kind,
      speakerName,
      speakerRole,
      content,
      contentHash,
      startOffset,
      endOffset,
    });

    // 発言ブロック間の改行 1 文字分を加算
    offset = endOffset + 1;
  }

  return result;
}
