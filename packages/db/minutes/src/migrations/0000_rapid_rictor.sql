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