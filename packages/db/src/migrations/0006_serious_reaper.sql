ALTER TABLE "meetings" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "topic_digests" jsonb;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "summary_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "summary_model" text;