CREATE TABLE "meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"municipality_code" text NOT NULL,
	"title" text NOT NULL,
	"meeting_type" text NOT NULL,
	"held_on" date NOT NULL,
	"source_url" text,
	"external_id" text
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"code" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"prefecture" text NOT NULL,
	"base_url" text,
	"population" integer,
	"population_year" integer
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
	"content_tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content, ''))) STORED
);
--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_municipality_code_municipalities_code_fk" FOREIGN KEY ("municipality_code") REFERENCES "public"."municipalities"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_municipality_code_external_id_index" ON "meetings" USING btree ("municipality_code","external_id");--> statement-breakpoint
CREATE INDEX "meetings_held_on_index" ON "meetings" USING btree ("held_on");--> statement-breakpoint
CREATE INDEX "meetings_meeting_type_held_on_index" ON "meetings" USING btree ("meeting_type","held_on");--> statement-breakpoint
CREATE INDEX "meetings_municipality_code_held_on_index" ON "meetings" USING btree ("municipality_code","held_on");--> statement-breakpoint
CREATE UNIQUE INDEX "municipalities_code_index" ON "municipalities" USING btree ("code");--> statement-breakpoint
CREATE INDEX "municipalities_prefecture_index" ON "municipalities" USING btree ("prefecture");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_meeting_id_content_hash_index" ON "statements" USING btree ("meeting_id","content_hash");--> statement-breakpoint
CREATE INDEX "statements_meeting_id_index" ON "statements" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "statements_kind_index" ON "statements" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "statements_speaker_name_index" ON "statements" USING btree ("speaker_name");