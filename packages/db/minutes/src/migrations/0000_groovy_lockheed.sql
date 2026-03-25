CREATE TABLE `municipalities` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`prefecture` text NOT NULL,
	`system_type` text,
	`base_url` text,
	`enabled` integer DEFAULT true NOT NULL,
	`population` integer,
	`population_year` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `municipalities_code_idx` ON `municipalities` (`code`);--> statement-breakpoint
CREATE INDEX `municipalities_prefecture_idx` ON `municipalities` (`prefecture`);--> statement-breakpoint
CREATE INDEX `municipalities_system_type_idx` ON `municipalities` (`system_type`);--> statement-breakpoint
CREATE INDEX `municipalities_enabled_system_type_idx` ON `municipalities` (`enabled`,`system_type`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`municipality_id` text NOT NULL,
	`title` text NOT NULL,
	`meeting_type` text NOT NULL,
	`held_on` text NOT NULL,
	`source_url` text,
	`external_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scraped_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meetings_municipality_external_id_idx` ON `meetings` (`municipality_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `meetings_held_on_idx` ON `meetings` (`held_on`);--> statement-breakpoint
CREATE INDEX `meetings_meeting_type_held_on_idx` ON `meetings` (`meeting_type`,`held_on`);--> statement-breakpoint
CREATE INDEX `meetings_municipality_held_on_idx` ON `meetings` (`municipality_id`,`held_on`);--> statement-breakpoint
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
CREATE INDEX `statements_speaker_name_idx` ON `statements` (`speaker_name`);--> statement-breakpoint
CREATE TABLE `minute_files` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`municipality_code` text NOT NULL,
	`meeting_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`source_url` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer,
	`upload_status` text DEFAULT 'pending' NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `minute_files_r2_key_idx` ON `minute_files` (`r2_key`);--> statement-breakpoint
CREATE INDEX `minute_files_municipality_code_idx` ON `minute_files` (`municipality_code`);--> statement-breakpoint
CREATE INDEX `minute_files_meeting_id_idx` ON `minute_files` (`meeting_id`);--> statement-breakpoint
CREATE INDEX `minute_files_upload_status_idx` ON `minute_files` (`upload_status`);--> statement-breakpoint
CREATE INDEX `minute_files_municipality_code_upload_status_idx` ON `minute_files` (`municipality_code`,`upload_status`);