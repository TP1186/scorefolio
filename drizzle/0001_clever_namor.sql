CREATE TABLE `document_processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`locked_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_processing_jobs_document_id_unique` ON `document_processing_jobs` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_processing_jobs_status_created` ON `document_processing_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_processing_jobs_owner` ON `document_processing_jobs` (`owner_id`);--> statement-breakpoint
ALTER TABLE `documents` ADD `status_reason` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `processed_at` integer;