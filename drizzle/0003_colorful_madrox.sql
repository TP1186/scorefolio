CREATE TABLE `document_workbook_cells` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`sheet_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`sheet_index` integer NOT NULL,
	`row_number` integer NOT NULL,
	`column_number` integer NOT NULL,
	`cell_reference` text NOT NULL,
	`value_type` text NOT NULL,
	`raw_value` text,
	`formula` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sheet_id`) REFERENCES `document_workbook_sheets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_workbook_cells_document_sheet_cell` ON `document_workbook_cells` (`document_id`,`sheet_index`,`cell_reference`);--> statement-breakpoint
CREATE TABLE `document_workbook_sheets` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`sheet_index` integer NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'visible' NOT NULL,
	`row_count` integer NOT NULL,
	`cell_count` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`audit_id`) REFERENCES `audits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_document_workbook_sheets_document_index` ON `document_workbook_sheets` (`document_id`,`sheet_index`);--> statement-breakpoint
PRAGMA optimize;
