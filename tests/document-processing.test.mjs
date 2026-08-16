import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDocumentTransition,
  runDocumentLifecycle,
} from "../lib/document-processing.ts";

function collectTransitions() {
  const transitions = [];
  return {
    transitions,
    record: async (from, to, reason) => transitions.push({ from, to, reason }),
  };
}

const document = {
  documentId: "synthetic-document",
  auditId: "synthetic-audit",
  ownerId: "synthetic-owner",
  objectKey: "synthetic/object",
  mimeType: "application/pdf",
};

test("a safe supported document reaches ready through every processing phase", async () => {
  const { transitions, record } = collectTransitions();
  const outcome = await runDocumentLifecycle(document, {
    scan: async () => ({ outcome: "safe" }),
    extract: async () => ({ outcome: "ready" }),
  }, record);

  assert.equal(outcome, "ready");
  assert.deepEqual(transitions.map(({ from, to }) => [from, to]), [
    ["uploaded", "scanning"],
    ["scanning", "extracting"],
    ["extracting", "ready"],
  ]);
});

test("low-confidence extraction stops at needs_review with its reason", async () => {
  const { transitions, record } = collectTransitions();
  const outcome = await runDocumentLifecycle(document, {
    scan: async () => ({ outcome: "safe" }),
    extract: async () => ({ outcome: "needs_review", reason: "Synthetic total requires confirmation" }),
  }, record);

  assert.equal(outcome, "needs_review");
  assert.equal(transitions.at(-1).reason, "Synthetic total requires confirmation");
});

test("unsafe content is quarantined before extraction", async () => {
  let extractionCalled = false;
  const { transitions, record } = collectTransitions();
  const outcome = await runDocumentLifecycle(document, {
    scan: async () => ({ outcome: "quarantined", reason: "Synthetic malware signature" }),
    extract: async () => {
      extractionCalled = true;
      return { outcome: "ready" };
    },
  }, record);

  assert.equal(outcome, "quarantined");
  assert.equal(extractionCalled, false);
  assert.deepEqual(transitions.map(({ to }) => to), ["scanning", "quarantined"]);
});

test("invalid lifecycle transitions are rejected", () => {
  assert.throws(() => assertDocumentTransition("uploaded", "ready"), /Invalid document status transition/);
  assert.throws(() => assertDocumentTransition("quarantined", "extracting"), /Invalid document status transition/);
});

test("adapter errors remain visible to the queue runner", async () => {
  const { record } = collectTransitions();
  await assert.rejects(() => runDocumentLifecycle(document, {
    scan: async () => { throw new Error("Synthetic scanner outage"); },
    extract: async () => ({ outcome: "ready" }),
  }, record), /Synthetic scanner outage/);
});

test("accepted uploads create durable jobs that the worker drains in the background", () => {
  const uploadRoute = readFileSync(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../drizzle/0001_clever_namor.sql", import.meta.url), "utf8");

  assert.match(uploadRoute, /INSERT INTO document_processing_jobs/);
  assert.match(uploadRoute, /'uploaded'/);
  assert.match(worker, /ctx\.waitUntil\(drainDocumentJobs/);
  assert.match(migration, /CREATE TABLE `document_processing_jobs`/);
  assert.match(migration, /idx_processing_jobs_status_created/);
});
