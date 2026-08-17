CREATE TABLE `document_text_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`text` text NOT NULL,
	`character_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_text_pages_document_page` ON `document_text_pages` (`document_id`,`page_number`);--> statement-breakpoint
CREATE INDEX `idx_document_text_pages_owner` ON `document_text_pages` (`owner_id`);