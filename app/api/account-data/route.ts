import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensurePortalSchema, getPortalEnv, recordActivity } from "@/lib/portal-store";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { DB, AUDIT_FILES } = getPortalEnv();
  await ensurePortalSchema(DB);
  const rows = await DB.prepare("SELECT object_key FROM documents WHERE owner_id = ?")
    .bind(user.userId).all<{ object_key: string }>();
  for (const row of rows.results) await AUDIT_FILES.delete(row.object_key);

  await DB.prepare("DELETE FROM documents WHERE owner_id = ?").bind(user.userId).run();
  await DB.prepare("DELETE FROM audits WHERE owner_id = ?").bind(user.userId).run();
  await recordActivity(DB, user.userId, "account.data_deleted", "All uploaded audit data deleted");
  return NextResponse.json({ ok: true, deletedFiles: rows.results.length });
}
