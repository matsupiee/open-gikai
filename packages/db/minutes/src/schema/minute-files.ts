import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "uploaded",
  "failed",
]);

/**
 * 議事録ファイル管理テーブル。
 * スクレイパーが取得した議事録ドキュメントの R2 アップロード状態を管理する。
 */
export const minute_files = pgTable(
  "minute_files",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    /** 総務省 地方公共団体コード（6桁） */
    municipalityCode: text().notNull(),
    /** meetings テーブルの ID（参照のみ、FK なし） */
    meetingId: text().notNull(),
    /** R2 オブジェクトキー（例: minutes/011002/2024-01-01/gijiroku.pdf） */
    r2Key: text().notNull().unique(),
    /** 元の取得 URL */
    sourceUrl: text().notNull(),
    /** MIME タイプ（例: application/pdf, text/html） */
    contentType: text().notNull(),
    /** ファイルサイズ（バイト） */
    fileSize: integer(),
    /** R2 アップロード状態 */
    uploadStatus: uploadStatusEnum("upload_status").notNull().default("pending"),
    /** アップロード失敗時のエラーメッセージ */
    errorMessage: text(),
  },
  (table) => [
    uniqueIndex().on(table.r2Key),
    index().on(table.municipalityCode),
    index().on(table.meetingId),
    index().on(table.uploadStatus),
    index().on(table.municipalityCode, table.uploadStatus),
  ]
);
