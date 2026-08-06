import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensurePortalSchema, getPortalEnv, mapDocument, recordActivity } from "@/lib/portal-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { DB } = getPortalEnv();
  await ensurePortalSchema(DB);

  let audit = await DB.prepare(
    "SELECT * FROM audits WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 1",
  ).bind(user.userId).first<Record<string, unknown>>();

  if (!audit) {
    const now = Date.now();
    const auditId = crypto.randomUUID();
    await DB.prepare(
      `INSERT INTO audits
       (id, owner_id, company_name, name, status, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'collecting', ?, ?, ?)`,
    ).bind(
      auditId,
      user.userId,
      "My business",
      "Annual workers’ comp audit",
      now + 30 * 24 * 60 * 60 * 1000,
      now,
      now,
    ).run();
    await recordActivity(DB, user.userId, "workspace.created", "Secure audit workspace created", auditId);
    audit = await DB.prepare("SELECT * FROM audits WHERE id = ? AND owner_id = ?")
      .bind(auditId, user.userId)
      .first<Record<string, unknown>>();
  }

  const documentRows = await DB.prepare(
    "SELECT * FROM documents WHERE audit_id = ? AND owner_id = ? ORDER BY created_at DESC",
  ).bind(String(audit?.id), user.userId).all<Record<string, unknown>>();

  const activityRows = await DB.prepare(
    "SELECT id, event, detail, created_at FROM activity WHERE owner_id = ? ORDER BY created_at DESC LIMIT 8",
  ).bind(user.userId).all<Record<string, unknown>>();

  return NextResponse.json({
    user: { displayName: user.displayName, email: user.email },
    audit: {
      id: String(audit?.id),
      companyName: String(audit?.company_name),
      name: String(audit?.name),
      policyNumber: audit?.policy_number ? String(audit.policy_number) : null,
      carrier: audit?.carrier ? String(audit.carrier) : null,
      status: String(audit?.status),
      dueAt: Number(audit?.due_at),
    },
    documents: documentRows.results.map(mapDocument),
    activity: activityRows.results.map((row) => ({
      id: String(row.id),
      event: String(row.event),
      detail: String(row.detail),
      createdAt: Number(row.created_at),
    })),
  });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const payload = await request.json() as { auditId?: string; companyName?: string; name?: string };
  const companyName = payload.companyName?.trim().slice(0, 120);
  const name = payload.name?.trim().slice(0, 120);
  if (!payload.auditId || (!companyName && !name)) {
    return NextResponse.json({ error: "Valid workspace details are required" }, { status: 400 });
  }

  const { DB } = getPortalEnv();
  await ensurePortalSchema(DB);
  const current = await DB.prepare("SELECT id FROM audits WHERE id = ? AND owner_id = ?")
    .bind(payload.auditId, user.userId).first();
  if (!current) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  await DB.prepare(
    "UPDATE audits SET company_name = COALESCE(?, company_name), name = COALESCE(?, name), updated_at = ? WHERE id = ? AND owner_id = ?",
  ).bind(companyName ?? null, name ?? null, Date.now(), payload.auditId, user.userId).run();
  await recordActivity(DB, user.userId, "workspace.updated", "Audit details updated", payload.auditId);
  return NextResponse.json({ ok: true });
}
