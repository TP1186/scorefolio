import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertDocumentTransition,
  runDocumentLifecycle,
} from "../lib/document-processing.ts";
import { createDocumentInspector, inspectDocumentBytes } from "../lib/document-inspection.ts";
import { createMalwareScanner } from "../lib/malware-scanning.ts";
import {
  corruptCsv,
  corruptJpeg,
  corruptPdf,
  corruptPng,
  corruptXlsx,
  legacyXls,
  passwordProtectedPdf,
  passwordProtectedXlsx,
  supportedCsv,
  supportedJpeg,
  supportedPdf,
  supportedPng,
  supportedXlsx,
  unsupportedCompressionXlsx,
  unsupportedZip,
} from "./fixtures/document-inspection-fixtures.mjs";
import {
  errorProvider,
  safeProvider,
  syntheticDocumentBytes,
  timeoutProvider,
  unsafeProvider,
} from "./fixtures/malware-scanner-fixtures.mjs";

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

function syntheticObjectStore() {
  return {
    async get() {
      return {
        async arrayBuffer() {
          return syntheticDocumentBytes.buffer.slice(
            syntheticDocumentBytes.byteOffset,
            syntheticDocumentBytes.byteOffset + syntheticDocumentBytes.byteLength,
          );
        },
      };
    },
  };
}

const supportedInspection = async () => ({ outcome: "supported" });

async function runScanLifecycle(provider, timeoutMs = 100) {
  let extractionCalled = false;
  const { transitions, record } = collectTransitions();
  const outcome = await runDocumentLifecycle(document, {
    scan: createMalwareScanner({ objectStore: syntheticObjectStore(), provider, timeoutMs }),
    inspect: supportedInspection,
    extract: async () => {
      extractionCalled = true;
      return { outcome: "ready" };
    },
  }, record);
  return { extractionCalled, outcome, transitions };
}

test("a safe supported document reaches ready through every processing phase", async () => {
  const { transitions, record } = collectTransitions();
  const outcome = await runDocumentLifecycle(document, {
    scan: async () => ({ outcome: "safe" }),
    inspect: supportedInspection,
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
    inspect: supportedInspection,
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
    inspect: supportedInspection,
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
    inspect: supportedInspection,
    extract: async () => ({ outcome: "ready" }),
  }, record), /Synthetic scanner outage/);
});

test("the provider-neutral scanner passes only synthetic bytes and document metadata", async () => {
  let received;
  const provider = {
    async scan(input, { signal }) {
      received = { input, signal };
      return { verdict: "clean" };
    },
  };
  const result = await createMalwareScanner({ objectStore: syntheticObjectStore(), provider })(document);

  assert.equal(result.outcome, "safe");
  assert.deepEqual(new Uint8Array(received.input.bytes), syntheticDocumentBytes);
  assert.equal(received.input.documentId, document.documentId);
  assert.equal(received.input.mimeType, document.mimeType);
  assert.equal("ownerId" in received.input, false);
  assert.equal("objectKey" in received.input, false);
  assert.equal(received.signal instanceof AbortSignal, true);
});

test("a synthetic safe verdict permits extraction", async () => {
  const result = await runScanLifecycle(safeProvider);

  assert.equal(result.outcome, "ready");
  assert.equal(result.extractionCalled, true);
  assert.deepEqual(result.transitions.map(({ to }) => to), ["scanning", "extracting", "ready"]);
});

test("a synthetic unsafe verdict quarantines the document before extraction", async () => {
  const result = await runScanLifecycle(unsafeProvider);

  assert.equal(result.outcome, "quarantined");
  assert.equal(result.extractionCalled, false);
  assert.match(result.transitions.at(-1).reason, /quarantined/i);
});

test("a synthetic scanner timeout stops processing at needs_review", async () => {
  const result = await runScanLifecycle(timeoutProvider, 5);

  assert.equal(result.outcome, "needs_review");
  assert.equal(result.extractionCalled, false);
  assert.match(result.transitions.at(-1).reason, /timed out/i);
});

test("a synthetic provider error stops processing at needs_review", async () => {
  const result = await runScanLifecycle(errorProvider);

  assert.equal(result.outcome, "needs_review");
  assert.equal(result.extractionCalled, false);
  assert.match(result.transitions.at(-1).reason, /could not be completed/i);
});

test("an unconfigured production scanner fails closed before object access", async () => {
  let objectRead = false;
  const scan = createMalwareScanner({
    objectStore: {
      async get() {
        objectRead = true;
        return null;
      },
    },
  });

  const result = await scan(document);
  assert.equal(result.outcome, "needs_review");
  assert.match(result.reason, /not configured/i);
  assert.equal(objectRead, false);
});

test("supported synthetic document structures pass inspection", () => {
  assert.equal(inspectDocumentBytes("application/pdf", supportedPdf).outcome, "supported");
  assert.equal(inspectDocumentBytes("text/csv", supportedCsv).outcome, "supported");
  assert.equal(inspectDocumentBytes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", supportedXlsx).outcome, "supported");
  assert.equal(inspectDocumentBytes("image/png", supportedPng).outcome, "supported");
  assert.equal(inspectDocumentBytes("image/jpeg", supportedJpeg).outcome, "supported");
});

test("password-protected PDF and XLSX fixtures are quarantined with an actionable reason", () => {
  for (const [mimeType, bytes] of [
    ["application/pdf", passwordProtectedPdf],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", passwordProtectedXlsx],
  ]) {
    const result = inspectDocumentBytes(mimeType, bytes);
    assert.equal(result.outcome, "quarantined");
    assert.match(result.reason, /password-protected/i);
    assert.match(result.reason, /unlocked copy/i);
  }
});

test("corrupt PDF, XLSX, PNG, and CSV fixtures are quarantined", () => {
  for (const [mimeType, bytes] of [
    ["application/pdf", corruptPdf],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", corruptXlsx],
    ["image/png", corruptPng],
    ["image/jpeg", corruptJpeg],
    ["text/csv", corruptCsv],
  ]) {
    const result = inspectDocumentBytes(mimeType, bytes);
    assert.equal(result.outcome, "quarantined");
    assert.match(result.reason, /corrupt|incomplete|UTF-8/i);
  }
});

test("unsupported archive layouts, compression, legacy spreadsheets, and MIME types are quarantined", () => {
  for (const [mimeType, bytes, expected] of [
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", unsupportedZip, /not a supported Excel workbook/i],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", unsupportedCompressionXlsx, /unsupported compression/i],
    ["application/vnd.ms-excel", legacyXls, /Legacy \.xls/i],
    ["application/msword", Uint8Array.of(1, 2, 3), /document type is not supported/i],
  ]) {
    const result = inspectDocumentBytes(mimeType, bytes);
    assert.equal(result.outcome, "quarantined");
    assert.match(result.reason, expected);
  }
});

test("structural inspection blocks extraction after a clean malware verdict", async () => {
  let extractionCalled = false;
  const { transitions, record } = collectTransitions();
  const objectStore = {
    async get() {
      return { async arrayBuffer() { return passwordProtectedPdf.slice().buffer; } };
    },
  };
  const outcome = await runDocumentLifecycle(document, {
    scan: async () => ({ outcome: "safe" }),
    inspect: createDocumentInspector({ objectStore }),
    extract: async () => {
      extractionCalled = true;
      return { outcome: "ready" };
    },
  }, record);

  assert.equal(outcome, "quarantined");
  assert.equal(extractionCalled, false);
  assert.deepEqual(transitions.map(({ to }) => to), ["scanning", "quarantined"]);
  assert.match(transitions.at(-1).reason, /password-protected/i);
});

test("accepted uploads create durable jobs that the worker drains in the background", () => {
  const uploadRoute = readFileSync(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../worker/index.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../drizzle/0001_clever_namor.sql", import.meta.url), "utf8");
  const extractionMigration = readFileSync(new URL("../drizzle/0002_red_odin.sql", import.meta.url), "utf8");
  const spreadsheetMigration = readFileSync(new URL("../drizzle/0003_colorful_madrox.sql", import.meta.url), "utf8");
  const redactionMigration = readFileSync(new URL("../drizzle/0004_tired_bill_hollister.sql", import.meta.url), "utf8");

  assert.match(uploadRoute, /INSERT INTO document_processing_jobs/);
  assert.match(uploadRoute, /allowedTypesByExtension\[extension\]\?\.has\(file\.type\)/);
  assert.match(uploadRoute, /extension === "xlsx".*\|\| isOle/);
  assert.match(uploadRoute, /extension === "xls" && isOle/);
  assert.match(uploadRoute, /'uploaded'/);
  assert.match(worker, /ctx\.waitUntil\(drainDocumentJobs/);
  assert.match(worker, /createNativePdfExtractor/);
  assert.match(worker, /createSpreadsheetExtractor/);
  assert.match(worker, /createDocumentExtractor/);
  assert.match(migration, /CREATE TABLE `document_processing_jobs`/);
  assert.match(migration, /idx_processing_jobs_status_created/);
  assert.match(extractionMigration, /CREATE TABLE `document_text_pages`/);
  assert.match(extractionMigration, /UNIQUE INDEX `idx_document_text_pages_document_page`/);
  assert.match(extractionMigration, /PRAGMA optimize/);
  assert.match(spreadsheetMigration, /CREATE TABLE `document_workbook_sheets`/);
  assert.match(spreadsheetMigration, /CREATE TABLE `document_workbook_cells`/);
  assert.match(spreadsheetMigration, /UNIQUE INDEX `idx_document_workbook_cells_document_sheet_cell`/);
  assert.match(spreadsheetMigration, /PRAGMA optimize/);
  assert.match(redactionMigration, /document_text_pages.*redaction_count/);
  assert.match(redactionMigration, /document_workbook_cells.*redaction_count/);
  assert.match(redactionMigration, /document_workbook_sheets.*redaction_count/);
});
