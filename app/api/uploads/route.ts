import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  categorizeDocument,
  ensurePortalSchema,
  getPortalEnv,
  mapDocument,
  recordActivity,
} from "@/lib/portal-store";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedTypesByExtension: Record<string, ReadonlySet<string>> = {
  pdf: new Set(["application/pdf"]),
  csv: new Set(["text/csv", "application/csv"]),
  xls: new Set(["application/vnd.ms-excel"]),
  xlsx: new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
  jpg: new Set(["image/jpeg"]),
  jpeg: new Set(["image/jpeg"]),
  png: new Set(["image/png"]),
};

function hasExpectedSignature(file: File, bytes: Uint8Array) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const isOle = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
    .every((value, index) => bytes[index] === value);
  if (extension === "pdf") return String.fromCharCode(...bytes.slice(0, 4)) === "%PDF";
  if (extension === "png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (extension === "jpg" || extension === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === "xlsx") return (bytes[0] === 0x50 && bytes[1] === 0x4b) || isOle;
  if (extension === "csv") return !bytes.includes(0);
  return extension === "xls" && isOle;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const auditId = form.get("auditId");
  if (!(file instanceof File) || typeof auditId !== "string") {
    return NextResponse.json({ error: "A file and audit workspace are required" }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedTypesByExtension[extension]?.has(file.type)) {
    return NextResponse.json({ error: "Use PDF, CSV, Excel, JPG, or PNG files" }, { status: 415 });
  }
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Files must be between 1 byte and 10 MB" }, { status: 413 });
  }
  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasExpectedSignature(file, signature)) {
    return NextResponse.json({ error: "The file contents do not match the extension" }, { status: 415 });
  }

  const { DB, AUDIT_FILES } = getPortalEnv();
  await ensurePortalSchema(DB);
  const audit = await DB.prepare("SELECT id FROM audits WHERE id = ? AND owner_id = ?")
    .bind(auditId, user.userId).first();
  if (!audit) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const documentId = crypto.randomUUID();
  const objectKey = `${user.userId}/${auditId}/${documentId}`;
  const category = categorizeDocument(file.name);
  await AUDIT_FILES.put(objectKey, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { ownerId: user.userId, auditId, documentId },
  });

  try {
    const now = Date.now();
    await DB.batch([
      DB.prepare(
        `INSERT INTO documents
         (id, audit_id, owner_id, filename, object_key, mime_type, size, category, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)`,
      ).bind(documentId, auditId, user.userId, file.name.slice(0, 180), objectKey, file.type, file.size, category, now),
      DB.prepare(
        `INSERT INTO document_processing_jobs
         (id, document_id, audit_id, owner_id, status, attempts, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)`,
      ).bind(crypto.randomUUID(), documentId, auditId, user.userId, now, now),
      DB.prepare("UPDATE audits SET updated_at = ? WHERE id = ? AND owner_id = ?")
        .bind(now, auditId, user.userId),
    ]);
    await recordActivity(DB, user.userId, "document.uploaded", `${category} uploaded`, auditId);
  } catch (error) {
    await AUDIT_FILES.delete(objectKey);
    throw error;
  }

  const row = await DB.prepare("SELECT * FROM documents WHERE id = ? AND owner_id = ?")
    .bind(documentId, user.userId).first<Record<string, unknown>>();
  return NextResponse.json({ document: row ? mapDocument(row) : null }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const documentId = new URL(request.url).searchParams.get("id");
  if (!documentId) return NextResponse.json({ error: "Document id required" }, { status: 400 });

  const { DB, AUDIT_FILES } = getPortalEnv();
  await ensurePortalSchema(DB);
  const row = await DB.prepare(
    "SELECT id, audit_id, object_key, category FROM documents WHERE id = ? AND owner_id = ?",
  ).bind(documentId, user.userId).first<Record<string, unknown>>();
  if (!row) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await AUDIT_FILES.delete(String(row.object_key));
  await DB.prepare("DELETE FROM documents WHERE id = ? AND owner_id = ?")
    .bind(documentId, user.userId).run();
  await recordActivity(DB, user.userId, "document.deleted", `${String(row.category)} deleted`, String(row.audit_id));
  return NextResponse.json({ ok: true });
}
