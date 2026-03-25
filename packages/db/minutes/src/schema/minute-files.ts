import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export type UploadStatus = "pending" | "uploaded" | "failed";

/**
 * 議事録ファイル管理テーブル。
 * スクレイパーが取得した議事録ドキュメントの R2 アップロード状態を管理する。
 */
export const minute_files = sqliteTable(
  "minute_files",
  {
    id: text()
      .$defaultFn(() => createId())
      .primaryKey(),
    createdAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer({ mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
    /** 総務省 地方公共団体コード（6桁） */
    municipalityCode: text().notNull(),
    /** meetings テーブルの ID（参照のみ） */
    meetingId: text().notNull(),
    /** R2 オブジェクトキー（例: minutes/011002/2024-01-01/gijiroku.pdf） */
    r2Key: text().notNull(),
    /** 元の取得 URL */
    sourceUrl: text().notNull(),
    /** MIME タイプ（例: application/pdf, text/html） */
    contentType: text().notNull(),
    /** ファイルサイズ（バイト） */
    fileSize: integer(),
    /** R2 アップロード状態: pending | uploaded | failed */
    uploadStatus: text().$type<UploadStatus>().notNull().default("pending"),
    /** アップロード失敗時のエラーメッセージ */
    errorMessage: text(),
  },
  (table) => [
    uniqueIndex("minute_files_r2_key_idx").on(table.r2Key),
    index("minute_files_municipality_code_idx").on(table.municipalityCode),
    index("minute_files_meeting_id_idx").on(table.meetingId),
    index("minute_files_upload_status_idx").on(table.uploadStatus),
    index("minute_files_municipality_code_upload_status_idx").on(
      table.municipalityCode,
      table.uploadStatus
    ),
  ]
);
