CREATE EXTENSION vector;
CREATE TYPE "public"."log_level" AS ENUM('info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."scraper_job_status" AS ENUM('pending', 'queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"scraped_at" timestamp,
	"municipality_id" text NOT NULL,
	"title" text NOT NULL,
	"meeting_type" text NOT NULL,
	"held_on" date NOT NULL,
	"source_url" text,
	"external_id" text,
	"raw_text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"prefecture" text NOT NULL,
	"system_type_id" text,
	"base_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"population" integer,
	"population_year" integer,
	CONSTRAINT "municipalities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"meeting_id" text NOT NULL,
	"kind" text NOT NULL,
	"speaker_name" text,
	"speaker_role" text,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	"chunk_id" text,
	"content_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "statement_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"meeting_id" text NOT NULL,
	"speaker_name" text,
	"speaker_role" text,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "policy_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"municipality_id" text NOT NULL,
	"status" "scraper_job_status" DEFAULT 'pending' NOT NULL,
	"year" integer NOT NULL,
	"processed_items" integer DEFAULT 0 NOT NULL,
	"total_items" integer,
	"total_inserted" integer DEFAULT 0 NOT NULL,
	"total_skipped" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "system_types" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "system_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_system_type_id_system_types_id_fk" FOREIGN KEY ("system_type_id") REFERENCES "public"."system_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_chunk_id_statement_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."statement_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_chunks" ADD CONSTRAINT "statement_chunks_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_policy_tags" ADD CONSTRAINT "statement_policy_tags_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_policy_tags" ADD CONSTRAINT "statement_policy_tags_tag_id_policy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."policy_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_job_logs" ADD CONSTRAINT "scraper_job_logs_job_id_scraper_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scraper_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraper_jobs" ADD CONSTRAINT "scraper_jobs_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_id_index" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_index" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_municipality_id_external_id_index" ON "meetings" USING btree ("municipality_id","external_id");--> statement-breakpoint
CREATE INDEX "meetings_held_on_index" ON "meetings" USING btree ("held_on");--> statement-breakpoint
CREATE INDEX "meetings_meeting_type_held_on_index" ON "meetings" USING btree ("meeting_type","held_on");--> statement-breakpoint
CREATE INDEX "meetings_municipality_id_held_on_index" ON "meetings" USING btree ("municipality_id","held_on");--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_code_index" ON "municipalities" USING btree ("code");--> statement-breakpoint
CREATE INDEX "municipalities_prefecture_index" ON "municipalities" USING btree ("prefecture");--> statement-breakpoint
CREATE INDEX "municipalities_system_type_id_index" ON "municipalities" USING btree ("system_type_id");--> statement-breakpoint
CREATE INDEX "municipalities_enabled_system_type_id_index" ON "municipalities" USING btree ("enabled","system_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_meeting_id_content_hash_index" ON "statements" USING btree ("meeting_id","content_hash");--> statement-breakpoint
CREATE INDEX "statements_meeting_id_index" ON "statements" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "statements_kind_index" ON "statements" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "statements_speaker_name_index" ON "statements" USING btree ("speaker_name");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_chunks_meeting_id_content_hash_index" ON "statement_chunks" USING btree ("meeting_id","content_hash");--> statement-breakpoint
CREATE INDEX "statement_chunks_meeting_id_index" ON "statement_chunks" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "statement_chunks_speaker_name_index" ON "statement_chunks" USING btree ("speaker_name");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_policy_tags_statement_id_tag_id_index" ON "statement_policy_tags" USING btree ("statement_id","tag_id");--> statement-breakpoint
CREATE INDEX "statement_policy_tags_tag_id_statement_id_index" ON "statement_policy_tags" USING btree ("tag_id","statement_id");--> statement-breakpoint
CREATE INDEX "scraper_job_logs_job_id_index" ON "scraper_job_logs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "scraper_job_logs_created_at_index" ON "scraper_job_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scraper_jobs_status_index" ON "scraper_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scraper_jobs_created_at_index" ON "scraper_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scraper_jobs_municipality_id_index" ON "scraper_jobs" USING btree ("municipality_id");--> statement-breakpoint
CREATE UNIQUE INDEX "system_types_name_index" ON "system_types" USING btree ("name");