CREATE TYPE "public"."topic_relevance" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TABLE "meeting_topics" (
	"meeting_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"relevance" "topic_relevance" NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_topics_meeting_id_topic_id_pk" PRIMARY KEY("meeting_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"municipality_code" text NOT NULL,
	"canonical_name" text NOT NULL,
	"aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "meeting_topics" ADD CONSTRAINT "meeting_topics_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_topics" ADD CONSTRAINT "meeting_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_municipality_code_municipalities_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_topics_topic_id_index" ON "meeting_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_municipality_code_canonical_name_index" ON "topics" USING btree ("municipality_code","canonical_name");--> statement-breakpoint
CREATE INDEX "topics_municipality_code_index" ON "topics" USING btree ("municipality_code");