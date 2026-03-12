CREATE TYPE "public"."system_type" AS ENUM('discussnet', 'dbsearch', 'sophia', 'voices', 'custom_html', 'pdf');--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"prefecture" text NOT NULL,
	"system_type" "system_type" NOT NULL,
	"base_url" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_scraped_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "municipalities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_code_idx" ON "municipalities" USING btree ("code");--> statement-breakpoint
CREATE INDEX "municipalities_prefecture_idx" ON "municipalities" USING btree ("prefecture");--> statement-breakpoint
CREATE INDEX "municipalities_system_type_idx" ON "municipalities" USING btree ("system_type");--> statement-breakpoint
CREATE INDEX "municipalities_enabled_system_type_idx" ON "municipalities" USING btree ("enabled","system_type");