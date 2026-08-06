CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text,
	`owner_id` text NOT NULL,
	`event` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_activity_owner_created` ON `activity` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`company_name` text NOT NULL,
	`name` text NOT NULL,
	`policy_number` text,
	`carrier` text,
	`status` text DEFAULT 'collecting' NOT NULL,
	`due_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audits_owner_updated` ON `audits` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`filename` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`category` text DEFAULT 'Uncategorized' NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_object_key_unique` ON `documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_documents_audit_created` ON `documents` (`audit_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_owner` ON `documents` (`owner_id`);