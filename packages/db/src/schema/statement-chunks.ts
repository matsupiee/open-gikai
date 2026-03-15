import {
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { meetings } from "./meetings";
import { createId } from "@paralleldrive/cuid2";

// pgvector カスタム型（statements.ts と同一定義）
const vector = (name: string, dimensions: number = 1536) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .replace(/[\[\]]/g, "")
        .split(",")
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v));
    },
  })(name);

/**
 * スピーカー単位にまとめた発言チャンクテーブル。
 *
 * statements の各行 embedding と比べて:
 * - 手続き系発言（○議長・△進行記号）を除外
 * - 同一スピーカーの連続発言を結合（質問・答弁の文脈が保たれる）
 * - embedding 数が約半減 → ベクトルインデックスのサイズ削減
 *
 * NOTE: embedding の HNSW インデックスはマイグレーション後に以下を実行する:
 *   CREATE INDEX ON statement_chunks USING hnsw (embedding vector_cosine_ops);
 */
export const statement_chunks = pgTable(
  "statement_chunks",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    // どの会議のチャンクか（会議削除時に連鎖削除）
    meetingId: text()
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    // 発言者名（手続き系除外後なので null は少ない）
    speakerName: text(),
    speakerRole: text(),
    // スピーカーグループ内での分割順序（通常 0、1500 文字超で増加）
    chunkIndex: integer().notNull().default(0),
    // 結合した発言テキスト
    content: text().notNull(),
    // 重複防止用ハッシュ（content の SHA-256）
    contentHash: text().notNull(),
    // AI 埋め込みベクトル（意味的類似度検索に使用）
    embedding: vector("embedding", 1536),
  },
  (table) => [
    // 同一会議内でのコンテンツ重複を防止
    uniqueIndex().on(table.meetingId, table.contentHash),
    // 会議 ID での絞り込みを高速化
    index().on(table.meetingId),
    // 発言者名での絞り込みを高速化
    index().on(table.speakerName),
  ]
);

export const statementChunksRelations = relations(
  statement_chunks,
  ({ one }) => ({
    meeting: one(meetings, {
      fields: [statement_chunks.meetingId],
      references: [meetings.id],
    }),
  })
);
