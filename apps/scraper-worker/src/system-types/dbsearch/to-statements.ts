/**
 * dbsr.jp — rawText → ParsedStatement 変換
 *
 * dbsearch の議事録はスクレイパーが <ul class="voice__list"> の各 <li> を
 * "\n\n---\n\n" セパレータで結合して rawText を生成する。
 * 各ブロックが1発言に対応しており、発言者情報は rawText には含まれない。
 */

import { createHash } from "node:crypto";
import type { ParsedStatement } from "../../utils/types";

const SEPARATOR = "\n\n---\n\n";
const SEPARATOR_LEN = SEPARATOR.length;

/**
 * dbsearch の rawText を ParsedStatement 配列に変換する。
 */
export function toStatements(rawText: string): ParsedStatement[] {
  const parts = rawText
    .split(SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);

  const texts = parts.length > 0 ? parts : [rawText.trim()];
  const result: ParsedStatement[] = [];
  let offset = 0;

  for (const part of texts) {
    const contentHash = createHash("sha256").update(part).digest("hex");
    const startOffset = offset;
    const endOffset = offset + part.length;

    result.push({
      kind: "question",
      speakerName: null,
      speakerRole: null,
      content: part,
      contentHash,
      startOffset,
      endOffset,
    });

    offset = endOffset + SEPARATOR_LEN;
  }

  return result;
}
