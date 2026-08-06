import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_documents_audit_created").on(table.auditId, table.createdAt),
    index("idx_documents_owner").on(table.ownerId),
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
