CREATE TABLE "guest_ask_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ip" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "guest_ask_usage_ip_created_at_index" ON "guest_ask_usage" USING btree ("ip","created_at");