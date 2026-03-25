ALTER TABLE "statement_chunks" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scraper_job_logs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scraper_jobs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "statement_chunks" CASCADE;--> statement-breakpoint
DROP TABLE "scraper_job_logs" CASCADE;--> statement-breakpoint
DROP TABLE "scraper_jobs" CASCADE;--> statement-breakpoint
ALTER TABLE "statements" DROP CONSTRAINT "statements_chunk_id_statement_chunks_id_fk";
--> statement-breakpoint
ALTER TABLE "statements" DROP COLUMN "chunk_id";--> statement-breakpoint
DROP TYPE "public"."log_level";--> statement-breakpoint
DROP TYPE "public"."scraper_job_status";