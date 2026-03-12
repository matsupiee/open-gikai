CREATE EXTENSION vector;
CREATE TYPE "public"."assembly_level" AS ENUM('national', 'prefectural', 'municipal');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."scraper_job_status" AS ENUM('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"meeting_type" text NOT NULL,
	"held_on" date NOT NULL,
	"source_url" text,
	"assembly_level" "assembly_level" NOT NULL,
	"prefecture" text,
	"municipality" text,
	"external_id" text,
	"raw_text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"scraped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"kind" text NOT NULL,
	"speaker_name" text,
	"speaker_role" text,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"page_hint" text,
	"embedding" vector(1536),
	"content_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "policy_tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "statement_policy_tags" (
	"statement_id" text NOT NULL,
	"tag_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_job_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"level" "log_level" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scraper_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" "scraper_job_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb NOT NULL,
	"processed_items" integer DEFAULT 0 NOT NULL,
	"total_items" integer,
	"total_inserted" integer DEFAULT 0 NOT NULL,
	"total_skipped" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_policy_tags" ADD CONSTRAINT "statement_policy_tags_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_policy_tags" ADD CONSTRAINT "statement_policy_tags_tag_id_policy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."policy_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_job_logs" ADD CONSTRAINT "scraper_job_logs_job_id_scraper_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraper_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_assembly_level_external_id_idx" ON "meetings" USING btree ("assembly_level","external_id");--> statement-breakpoint
CREATE INDEX "meetings_held_on_idx" ON "meetings" USING btree ("held_on");--> statement-breakpoint
CREATE INDEX "meetings_meeting_type_held_on_idx" ON "meetings" USING btree ("meeting_type","held_on");--> statement-breakpoint
CREATE INDEX "meetings_assembly_level_held_on_idx" ON "meetings" USING btree ("assembly_level","held_on");--> statement-breakpoint
CREATE INDEX "meetings_prefecture_held_on_idx" ON "meetings" USING btree ("prefecture","held_on");--> statement-breakpoint
CREATE INDEX "meetings_municipality_held_on_idx" ON "meetings" USING btree ("municipality","held_on");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_meeting_id_content_hash_idx" ON "statements" USING btree ("meeting_id","content_hash");--> statement-breakpoint
CREATE INDEX "statements_meeting_id_idx" ON "statements" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "statements_kind_idx" ON "statements" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "statements_speaker_name_idx" ON "statements" USING btree ("speaker_name");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_policy_tags_statement_id_tag_id_idx" ON "statement_policy_tags" USING btree ("statement_id","tag_id");--> statement-breakpoint
CREATE INDEX "statement_policy_tags_tag_id_statement_id_idx" ON "statement_policy_tags" USING btree ("tag_id","statement_id");--> statement-breakpoint
CREATE INDEX "scraper_job_logs_job_id_idx" ON "scraper_job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "scraper_job_logs_created_at_idx" ON "scraper_job_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scraper_jobs_status_idx" ON "scraper_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scraper_jobs_created_at_idx" ON "scraper_jobs" USING btree ("created_at");