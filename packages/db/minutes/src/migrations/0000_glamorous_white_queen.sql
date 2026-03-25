CREATE TYPE "public"."upload_status" AS ENUM('pending', 'uploaded', 'failed');--> statement-breakpoint
CREATE TABLE "minute_files" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"municipality_code" text NOT NULL,
	"meeting_id" text NOT NULL,
	"r2_key" text NOT NULL,
	"source_url" text NOT NULL,
	"content_type" text NOT NULL,
	"file_size" integer,
	"upload_status" "upload_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	CONSTRAINT "minute_files_r2Key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "minute_files_r2_key_index" ON "minute_files" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "minute_files_municipality_code_index" ON "minute_files" USING btree ("municipality_code");--> statement-breakpoint
CREATE INDEX "minute_files_meeting_id_index" ON "minute_files" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "minute_files_upload_status_index" ON "minute_files" USING btree ("upload_status");--> statement-breakpoint
CREATE INDEX "minute_files_municipality_code_upload_status_index" ON "minute_files" USING btree ("municipality_code","upload_status");