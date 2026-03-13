CREATE TABLE "system_types" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "system_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "municipalities" RENAME COLUMN "system_type" TO "system_type_id";--> statement-breakpoint
DROP INDEX "municipalities_system_type_index";--> statement-breakpoint
DROP INDEX "municipalities_enabled_system_type_index";--> statement-breakpoint
CREATE UNIQUE INDEX "system_types_name_index" ON "system_types" USING btree ("name");--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_system_type_id_system_types_id_fk" FOREIGN KEY ("system_type_id") REFERENCES "public"."system_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "municipalities_system_type_id_index" ON "municipalities" USING btree ("system_type_id");--> statement-breakpoint
CREATE INDEX "municipalities_enabled_system_type_id_index" ON "municipalities" USING btree ("enabled","system_type_id");--> statement-breakpoint
DROP TYPE "public"."system_type";