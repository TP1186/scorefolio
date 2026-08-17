import { env } from "cloudflare:workers";

type PortalEnv = {
  DB: D1Database;
  AUDIT_FILES: R2Bucket;
};

export type StoredDocument = {
  id: string;
  auditId: string;
  filename: string;
  mimeType: string;
  size: number;
  category: string;
  status: string;
  statusReason: string | null;
  processedAt: number | null;
  createdAt: number;
};

export function getPortalEnv(): PortalEnv {
  return env as unknown as PortalEnv;
}

export async function ensurePortalSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      name TEXT NOT NULL,
      policy_number TEXT,
      carrier TEXT,
      status TEXT NOT NULL DEFAULT 'collecting',
      due_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      audit_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT 'Uncategorized',
      status TEXT NOT NULL DEFAULT 'uploaded',
      status_reason TEXT,
      processed_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS document_processing_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL UNIQUE,
      audit_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      locked_at INTEGER,
      last_error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS document_text_pages (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      audit_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      page_number INTEGER NOT NULL,
      text TEXT NOT NULL,
      character_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY NOT NULL,
      audit_id TEXT,
      owner_id TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_audits_owner_updated ON audits(owner_id, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_documents_audit_created ON documents(audit_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_processing_jobs_status_created ON document_processing_jobs(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_processing_jobs_owner ON document_processing_jobs(owner_id)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_document_text_pages_document_page ON document_text_pages(document_id, page_number)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_document_text_pages_owner ON document_text_pages(owner_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_activity_owner_created ON activity(owner_id, created_at)"),
  ]);
}

export function categorizeDocument(filename: string) {
  const normalized = filename.toLowerCase();
  if (/payroll|wage|earnings|register/.test(normalized)) return "Payroll summary";
  if (/941|quarter|tax|w-?2/.test(normalized)) return "Quarterly tax filings";
  if (/ledger|gl\b|general-ledger/.test(normalized)) return "General ledger";
  if (/coi|certificate|subcontract|contractor/.test(normalized)) return "Subcontractor certificates";
  if (/policy|declaration|dec-page/.test(normalized)) return "Policy documents";
  return "Other supporting record";
}

export async function recordActivity(
  db: D1Database,
  ownerId: string,
  event: string,
  detail: string,
  auditId?: string,
) {
  await db.prepare(
    "INSERT INTO activity (id, audit_id, owner_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).bind(crypto.randomUUID(), auditId ?? null, ownerId, event, detail, Date.now()).run();
}

export function mapDocument(row: Record<string, unknown>): StoredDocument {
  return {
    id: String(row.id),
    auditId: String(row.audit_id),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    size: Number(row.size),
    category: String(row.category),
    status: String(row.status),
    statusReason: row.status_reason ? String(row.status_reason) : null,
    processedAt: row.processed_at ? Number(row.processed_at) : null,
    createdAt: Number(row.created_at),
  };
}
