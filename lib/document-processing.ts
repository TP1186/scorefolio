export const documentStatuses = [
  "uploaded",
  "scanning",
  "extracting",
  "ready",
  "needs_review",
  "quarantined",
  "failed",
] as const;

export type DocumentStatus = (typeof documentStatuses)[number];

const allowedTransitions: Record<DocumentStatus, readonly DocumentStatus[]> = {
  uploaded: ["scanning", "failed"],
  scanning: ["extracting", "needs_review", "quarantined", "failed"],
  extracting: ["ready", "needs_review", "failed"],
  ready: [],
  needs_review: [],
  quarantined: [],
  failed: [],
};

export function assertDocumentTransition(from: DocumentStatus, to: DocumentStatus) {
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid document status transition: ${from} -> ${to}`);
  }
}

export type ProcessingDocument = {
  documentId: string;
  auditId: string;
  ownerId: string;
  objectKey: string;
  mimeType: string;
};

export type MalwareScanResult =
  | { outcome: "safe" }
  | { outcome: "needs_review" | "quarantined"; reason: string };

export type DocumentInspectionResult =
  | { outcome: "supported" }
  | { outcome: "quarantined"; reason: string };

export type ExtractionResult =
  | { outcome: "ready" }
  | { outcome: "needs_review"; reason: string };

export type DocumentProcessingAdapters = {
  scan(document: ProcessingDocument): Promise<MalwareScanResult>;
  inspect(document: ProcessingDocument): Promise<DocumentInspectionResult>;
  extract(document: ProcessingDocument): Promise<ExtractionResult>;
};

export async function runDocumentLifecycle(
  document: ProcessingDocument,
  adapters: DocumentProcessingAdapters,
  transition: (from: DocumentStatus, to: DocumentStatus, reason?: string) => Promise<void>,
) {
  await transition("uploaded", "scanning");
  const scan = await adapters.scan(document);
  if (scan.outcome !== "safe") {
    await transition("scanning", scan.outcome, scan.reason);
    return scan.outcome;
  }

  const inspection = await adapters.inspect(document);
  if (inspection.outcome !== "supported") {
    await transition("scanning", inspection.outcome, inspection.reason);
    return inspection.outcome;
  }

  await transition("scanning", "extracting");
  const extraction = await adapters.extract(document);
  await transition("extracting", extraction.outcome, extraction.outcome === "needs_review" ? extraction.reason : undefined);
  return extraction.outcome;
}

type ClaimedJob = ProcessingDocument & {
  jobId: string;
  attempts: number;
};

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

async function claimNextJob(db: D1Database): Promise<ClaimedJob | null> {
  const now = Date.now();
  const row = await db.prepare(
    `UPDATE document_processing_jobs
     SET status = 'processing', attempts = attempts + 1, locked_at = ?, updated_at = ?, last_error = NULL
     WHERE id = (
       SELECT id FROM document_processing_jobs
       WHERE status = 'queued' OR (status = 'processing' AND locked_at < ?)
       ORDER BY created_at ASC
       LIMIT 1
     )
     RETURNING id, document_id, audit_id, owner_id, attempts`,
  ).bind(now, now, now - PROCESSING_LEASE_MS).first<Record<string, unknown>>();

  if (!row) return null;

  const document = await db.prepare(
    "SELECT object_key, mime_type, status FROM documents WHERE id = ? AND owner_id = ?",
  ).bind(String(row.document_id), String(row.owner_id)).first<Record<string, unknown>>();

  if (!document) {
    await db.prepare(
      "UPDATE document_processing_jobs SET status = 'failed', last_error = ?, locked_at = NULL, updated_at = ? WHERE id = ?",
    ).bind("Document metadata no longer exists", Date.now(), String(row.id)).run();
    return null;
  }

  if (document.status === "scanning" || document.status === "extracting") {
    await db.prepare(
      "UPDATE documents SET status = 'uploaded', status_reason = ? WHERE id = ? AND owner_id = ?",
    ).bind("Processing resumed after an expired worker lease", String(row.document_id), String(row.owner_id)).run();
  }

  return {
    jobId: String(row.id),
    documentId: String(row.document_id),
    auditId: String(row.audit_id),
    ownerId: String(row.owner_id),
    objectKey: String(document.object_key),
    mimeType: String(document.mime_type),
    attempts: Number(row.attempts),
  };
}

async function persistTransition(
  db: D1Database,
  job: ClaimedJob,
  from: DocumentStatus,
  to: DocumentStatus,
  reason?: string,
) {
  assertDocumentTransition(from, to);
  const terminal = ["ready", "needs_review", "quarantined", "failed"].includes(to);
  const result = await db.prepare(
    `UPDATE documents
     SET status = ?, status_reason = ?, processed_at = ?
     WHERE id = ? AND owner_id = ? AND status = ?`,
  ).bind(to, reason ?? null, terminal ? Date.now() : null, job.documentId, job.ownerId, from).run();

  if (result.meta.changes !== 1) {
    throw new Error(`Document ${job.documentId} was not in expected ${from} state`);
  }
}

export async function processNextDocumentJob(
  db: D1Database,
  adapters: DocumentProcessingAdapters,
) {
  const job = await claimNextJob(db);
  if (!job) return false;

  let currentStatus: DocumentStatus = "uploaded";
  try {
    const finalStatus = await runDocumentLifecycle(job, adapters, async (from, to, reason) => {
      await persistTransition(db, job, from, to, reason);
      currentStatus = to;
    });
    const now = Date.now();
    await db.prepare(
      "UPDATE document_processing_jobs SET status = 'completed', locked_at = NULL, updated_at = ? WHERE id = ?",
    ).bind(now, job.jobId).run();
    try {
      await db.prepare(
        "INSERT INTO activity (id, audit_id, owner_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(
        crypto.randomUUID(),
        job.auditId,
        job.ownerId,
        finalStatus === "needs_review" ? "document.processing_attention" : `document.${finalStatus}`,
        finalStatus === "needs_review" ? "Document processing needs review" : `Document processing finished: ${finalStatus}`,
        now,
      ).run();
    } catch (error) {
      console.error("Document processing activity could not be recorded", error);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown processing error";
    if (["uploaded", "scanning", "extracting"].includes(currentStatus)) {
      try {
        await persistTransition(db, job, currentStatus, "failed", "Processing stopped unexpectedly");
      } catch (transitionError) {
        console.error("Document failure state could not be persisted", transitionError);
      }
    }
    await db.prepare(
      "UPDATE document_processing_jobs SET status = 'failed', last_error = ?, locked_at = NULL, updated_at = ? WHERE id = ?",
    ).bind(message, Date.now(), job.jobId).run();
  }

  return true;
}

export async function drainDocumentJobs(
  db: D1Database,
  adapters: DocumentProcessingAdapters,
  limit = 4,
) {
  for (let processed = 0; processed < limit; processed += 1) {
    if (!(await processNextDocumentJob(db, adapters))) return processed;
  }
  return limit;
}
