ALTER TABLE "statement_chunks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scraper_job_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scraper_jobs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "statement_chunks" CASCADE;--> statement-breakpoint
DROP TABLE "scraper_job_logs" CASCADE;--> statement-breakpoint
DROP TABLE "scraper_jobs" CASCADE;--> statement-breakpoint
ALTER TABLE "statements" DROP COLUMN IF EXISTS "chunk_id";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."log_level";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."scraper_job_status";
