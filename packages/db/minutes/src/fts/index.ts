import type { Db } from "../index";

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
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(tokenizeBigram)
    .join(" ");
}

/**
 * FTS5 virtual table を作成する。
 *
 * Drizzle-kit は virtual table を生成できないため、
 * マイグレーション後にこの関数を呼び出す。
 *
 * テーブル構造:
 * - `statement_id`: statements.id（UNINDEXED = FTS インデックス対象外）
 * - `bigrams`: 2-gram トークン化済みの発言内容
 */
export function setupFts(db: Db): void {
  db.$client.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS statements_fts USING fts5(
      statement_id UNINDEXED,
      bigrams,
      tokenize = 'unicode61'
    )
  `);
}

/**
 * statements テーブルの全レコードを FTS5 インデックスに投入する。
 * bigram 変換は JS 側で行い、SQLite に挿入する。
 *
 * 大量データの場合はバッチ処理で実行する。
 */
export function populateFts(db: Db, batchSize = 1000): void {
  const sqlite = db.$client;

  const count =
    sqlite
      .query<{ count: number }, []>(
        "SELECT COUNT(*) as count FROM statements"
      )
      .get()?.count ?? 0;

  const insert = sqlite.prepare<void, [string, string]>(
    "INSERT OR REPLACE INTO statements_fts(statement_id, bigrams) VALUES (?, ?)"
  );

  const select = sqlite.prepare<{ id: string; content: string }, [number, number]>(
    "SELECT id, content FROM statements LIMIT ? OFFSET ?"
  );

  sqlite.transaction(() => {
    for (let offset = 0; offset < count; offset += batchSize) {
      const rows = select.all(batchSize, offset);
      for (const row of rows) {
        insert.run(row.id, tokenizeBigram(row.content));
      }
    }
  })();
}
