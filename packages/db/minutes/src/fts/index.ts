/**
 * テキストを 2-gram トークン列に変換する。
 *
 * 日本語は単語境界がないため、連続する 2 文字ずつをトークンとして扱う。
 * - NFKC 正規化（全角英数 → 半角など）
 * - スペースをまたぐ bigram はスキップ
 *
 * @example
 * tokenizeBigram("東京都議会") // "東京 京都 都議 議会"
 */
export function tokenizeBigram(text: string): string {
  const normalized = text
    .normalize("NFKC")
    .replace(/[\s\u3000]+/g, " ")
    .trim();
  if (normalized.length < 2) return normalized;

  const tokens: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    const bigram = normalized.slice(i, i + 2);
    if (!bigram.includes(" ")) {
      tokens.push(bigram);
    }
  }
  return tokens.join(" ");
}

/**
 * 検索クエリを bigram トークン列に変換する。
 * スペース区切りの各キーワードをそれぞれ bigram 化して結合する。
 *
 * @example
 * tokenizeSearchQuery("東京 教育") // "東京 教育"（1文字キーワードはそのまま）
 */
export function tokenizeSearchQuery(query: string): string {
  return query.trim().split(/\s+/).filter(Boolean).map(tokenizeBigram).join(" ");
}
