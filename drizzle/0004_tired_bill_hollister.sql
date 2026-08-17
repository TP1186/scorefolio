ALTER TABLE `document_text_pages` ADD `redaction_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_workbook_cells` ADD `redaction_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_workbook_sheets` ADD `redaction_count` integer DEFAULT 0 NOT NULL;