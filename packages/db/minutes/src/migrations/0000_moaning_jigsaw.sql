CREATE TABLE `municipalities` (
	`code` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`name` text NOT NULL,
	`prefecture` text NOT NULL,
	`region_slug` text NOT NULL,
	`base_url` text,
	`enabled` integer DEFAULT true NOT NULL,
	`population` integer,
	`population_year` integer
);
--> statement-breakpoint
CREATE INDEX `municipalities_prefecture_idx` ON `municipalities` (`prefecture`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`municipality_code` text NOT NULL,
	`title` text NOT NULL,
	`meeting_type` text NOT NULL,
	`held_on` text NOT NULL,
	`source_url` text,
	`external_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scraped_at` integer,
	FOREIGN KEY (`municipality_code`) REFERENCES `municipalities`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_municipality_external_id_idx` ON `meetings` (`municipality_code`,`external_id`);--> statement-breakpoint
CREATE INDEX `meetings_held_on_idx` ON `meetings` (`held_on`);--> statement-breakpoint
CREATE INDEX `meetings_meeting_type_held_on_idx` ON `meetings` (`meeting_type`,`held_on`);--> statement-breakpoint
CREATE INDEX `meetings_municipality_held_on_idx` ON `meetings` (`municipality_code`,`held_on`);--> statement-breakpoint
CREATE TABLE `statements` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`meeting_id` text NOT NULL,
	`kind` text NOT NULL,
	`speaker_name` text,
	`speaker_role` text,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`start_offset` integer,
	`end_offset` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `statements_meeting_content_hash_idx` ON `statements` (`meeting_id`,`content_hash`);--> statement-breakpoint
CREATE INDEX `statements_meeting_id_idx` ON `statements` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `statements_kind_idx` ON `statements` (`kind`);--> statement-breakpoint
CREATE INDEX `statements_speaker_name_idx` ON `statements` (`speaker_name`);