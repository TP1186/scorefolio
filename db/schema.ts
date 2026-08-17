import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const audits = sqliteTable(
  "audits",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    companyName: text("company_name").notNull(),
    name: text("name").notNull(),
    policyNumber: text("policy_number"),
    carrier: text("carrier"),
    status: text("status").notNull().default("collecting"),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_audits_owner_updated").on(table.ownerId, table.updatedAt)],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    filename: text("filename").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    category: text("category").notNull().default("Uncategorized"),
    status: text("status").notNull().default("uploaded"),
    statusReason: text("status_reason"),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_documents_audit_created").on(table.auditId, table.createdAt),
    index("idx_documents_owner").on(table.ownerId),
  ],
);

export const documentProcessingJobs = sqliteTable(
  "document_processing_jobs",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().unique().references(() => documents.id, { onDelete: "cascade" }),
    auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    lockedAt: integer("locked_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_processing_jobs_status_created").on(table.status, table.createdAt),
    index("idx_processing_jobs_owner").on(table.ownerId),
  ],
);

export const documentTextPages = sqliteTable(
  "document_text_pages",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    pageNumber: integer("page_number").notNull(),
    text: text("text").notNull(),
    characterCount: integer("character_count").notNull(),
    redactionCount: integer("redaction_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_document_text_pages_document_page").on(table.documentId, table.pageNumber),
  ],
);

export const documentWorkbookSheets = sqliteTable(
  "document_workbook_sheets",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    sheetIndex: integer("sheet_index").notNull(),
    name: text("name").notNull(),
    visibility: text("visibility").notNull().default("visible"),
    rowCount: integer("row_count").notNull(),
    cellCount: integer("cell_count").notNull(),
    redactionCount: integer("redaction_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_document_workbook_sheets_document_index").on(table.documentId, table.sheetIndex),
  ],
);

export const documentWorkbookCells = sqliteTable(
  "document_workbook_cells",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    sheetId: text("sheet_id").notNull().references(() => documentWorkbookSheets.id, { onDelete: "cascade" }),
    auditId: text("audit_id").notNull().references(() => audits.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    sheetIndex: integer("sheet_index").notNull(),
    rowNumber: integer("row_number").notNull(),
    columnNumber: integer("column_number").notNull(),
    cellReference: text("cell_reference").notNull(),
    valueType: text("value_type").notNull(),
    rawValue: text("raw_value"),
    formula: text("formula"),
    redactionCount: integer("redaction_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("idx_document_workbook_cells_document_sheet_cell").on(
      table.documentId,
      table.sheetIndex,
      table.cellReference,
    ),
  ],
);

export const activity = sqliteTable(
  "activity",
  {
    id: text("id").primaryKey(),
    auditId: text("audit_id").references(() => audits.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull(),
    event: text("event").notNull(),
    detail: text("detail").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("idx_activity_owner_created").on(table.ownerId, table.createdAt)],
);
