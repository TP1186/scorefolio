import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentInspector } from "../lib/document-inspection.ts";
import { runDocumentLifecycle } from "../lib/document-processing.ts";
import {
  createNativePdfExtractor,
  extractNativePdfText,
} from "../lib/pdf-text-extraction.ts";
import { SSN_REDACTION_MARKER } from "../lib/pii-redaction.ts";
import {
  syntheticForm941Pdf,
  syntheticPayrollPdf,
  syntheticScannedPdf,
} from "./fixtures/native-pdf-fixtures.mjs";

function asArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function createDatabaseRecorder() {
  const batches = [];
  return {
    batches,
    prepare(sql) {
      return {
        bind(...args) {
          return { args, sql };
        },
      };
    },
    async batch(statements) {
      batches.push(statements);
      return statements.map(() => ({ success: true }));
    },
  };
}

const document = {
  documentId: "synthetic-document",
  auditId: "synthetic-audit",
  ownerId: "synthetic-owner",
  objectKey: "synthetic/object",
  mimeType: "application/pdf",
};

test("native payroll PDF text is extracted with one-based source pages", async () => {
  const result = await extractNativePdfText(syntheticPayrollPdf);

  assert.equal(result.outcome, "ready");
  assert.equal(result.pages.length, 2);
  assert.deepEqual(result.pages.map(({ pageNumber }) => pageNumber), [1, 2]);
  assert.match(result.pages[0].text, /SYNTHETIC PAYROLL REGISTER/);
  assert.match(result.pages[0].text, /125000\.00/);
  assert.match(result.pages[1].text, /TEST-002 gross wages: 62500\.00/);
  assert.match(result.pages[1].text, new RegExp(SSN_REDACTION_MARKER.replace(/[\[\]]/g, "\\$&")));
  assert.doesNotMatch(result.pages[1].text, /987-65-4321/);
  assert.equal(result.pages[1].redactionCount, 1);
});

test("synthetic Form 941 fixture preserves page boundaries", async () => {
  const result = await extractNativePdfText(syntheticForm941Pdf);

  assert.equal(result.outcome, "ready");
  assert.match(result.pages[0].text, /NOT A TAX FILING/);
  assert.doesNotMatch(result.pages[0].text, /CONTINUATION/);
  assert.match(result.pages[1].text, /CONTINUATION/);
});

test("PDFs without a native text layer need OCR review", async () => {
  const result = await extractNativePdfText(syntheticScannedPdf);

  assert.equal(result.outcome, "needs_review");
  assert.match(result.reason, /native text layer/i);
  assert.match(result.reason, /OCR/i);
});

test("page and text limits fail closed before extracted text is accepted", async () => {
  const pageLimited = await extractNativePdfText(syntheticPayrollPdf, { maxPages: 1 });
  const textLimited = await extractNativePdfText(syntheticPayrollPdf, { maxTextCharacters: 20 });

  assert.equal(pageLimited.outcome, "needs_review");
  assert.match(pageLimited.reason, /too many pages/i);
  assert.equal(textLimited.outcome, "needs_review");
  assert.match(textLimited.reason, /too much text/i);
});

test("the PDF adapter stores extracted text separately with page references", async () => {
  const db = createDatabaseRecorder();
  const extract = createNativePdfExtractor({
    db,
    objectStore: {
      async get(key) {
        assert.equal(key, document.objectKey);
        return { async arrayBuffer() { return asArrayBuffer(syntheticPayrollPdf); } };
      },
    },
  });

  const result = await extract(document);

  assert.equal(result.outcome, "ready");
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 3);
  assert.match(db.batches[0][0].sql, /DELETE FROM document_text_pages/);
  for (const [index, statement] of db.batches[0].slice(1).entries()) {
    assert.match(statement.sql, /INSERT INTO document_text_pages/);
    assert.equal(statement.args[1], document.documentId);
    assert.equal(statement.args[2], document.auditId);
    assert.equal(statement.args[3], document.ownerId);
    assert.equal(statement.args[4], index + 1);
    assert.equal(statement.args[6], statement.args[5].length);
    assert.equal(statement.args[7], index === 1 ? 1 : 0);
  }
});

test("a clean, structurally supported native PDF completes the real extraction lifecycle", async () => {
  const db = createDatabaseRecorder();
  const transitions = [];
  const objectStore = {
    async get() {
      return { async arrayBuffer() { return asArrayBuffer(syntheticForm941Pdf); } };
    },
  };

  const outcome = await runDocumentLifecycle(document, {
    scan: async () => ({ outcome: "safe" }),
    inspect: createDocumentInspector({ objectStore }),
    extract: createNativePdfExtractor({ db, objectStore }),
  }, async (from, to, reason) => transitions.push({ from, to, reason }));

  assert.equal(outcome, "ready");
  assert.deepEqual(transitions.map(({ to }) => to), ["scanning", "extracting", "ready"]);
  assert.equal(db.batches[0].length, 3);
});

test("non-PDF documents stop before private object access", async () => {
  let objectRead = false;
  const extract = createNativePdfExtractor({
    db: createDatabaseRecorder(),
    objectStore: {
      async get() {
        objectRead = true;
        return null;
      },
    },
  });

  const result = await extract({ ...document, mimeType: "text/csv" });
  assert.equal(result.outcome, "needs_review");
  assert.match(result.reason, /only for PDF/i);
  assert.equal(objectRead, false);
});
