import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("builds the AuditSentry marketing site and secure portal", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const portal = readFileSync(new URL("../app/portal/page.tsx", import.meta.url), "utf8");
  const uploads = readFileSync(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");
  const hosting = JSON.parse(readFileSync(new URL("../.openai/hosting.json", import.meta.url), "utf8"));

  assert.match(page, /Turn your audit paperwork into one ready-to-send packet/);
  assert.match(page, /Private by default/);
  assert.match(portal, /requireChatGPTUser/);
  assert.match(uploads, /ownerId/);
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "AUDIT_FILES");
  assert.equal(existsSync(new URL("../dist/server/index.js", import.meta.url)), true);
});
