import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentExtractor } from "../lib/document-extraction.ts";
import { createDocumentInspector } from "../lib/document-inspection.ts";
import { runDocumentLifecycle } from "../lib/document-processing.ts";
import {
  createSpreadsheetExtractor,
  extractCsvStructure,
  extractXlsxStructure,
} from "../lib/spreadsheet-extraction.ts";
import {
  syntheticGeneralLedgerCsv,
  syntheticStructuredWorkbook,
} from "./fixtures/spreadsheet-fixtures.mjs";

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

const csvDocument = {
  documentId: "synthetic-csv-document",
  auditId: "synthetic-audit",
  ownerId: "synthetic-owner",
  objectKey: "synthetic/ledger.csv",
  mimeType: "text/csv",
};

const xlsxDocument = {
  ...csvDocument,
  documentId: "synthetic-xlsx-document",
  objectKey: "synthetic/payroll.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

test("CSV extraction preserves logical rows, blank row gaps, quoted commas, and exact cells", () => {
  const result = extractCsvStructure(syntheticGeneralLedgerCsv);

  assert.equal(result.outcome, "ready");
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].name, "CSV");
  assert.equal(result.sheets[0].rowCount, 5);
  assert.equal(result.sheets[0].cells.length, 10);
  assert.deepEqual(
    result.sheets[0].cells.filter(({ rowNumber }) => rowNumber === 3).map(({ cellReference, rawValue }) => [cellReference, rawValue]),
    [["A3", "5000"], ["B3", "Synthetic labor, regular"], ["C3", "125000.00"]],
  );
  assert.equal(result.sheets[0].cells.some(({ rowNumber }) => rowNumber === 4), false);
  assert.equal(result.sheets[0].cells.find(({ cellReference }) => cellReference === "A5").rawValue, "5100");
  assert.equal(result.sheets[0].cells.every(({ valueType }) => valueType === "text"), true);
});

test("XLSX extraction preserves sheet order, visibility, sparse rows, types, rich text, and formulas", () => {
  const result = extractXlsxStructure(syntheticStructuredWorkbook);

  assert.equal(result.outcome, "ready");
  assert.deepEqual(result.sheets.map(({ sheetIndex, name, visibility, rowCount }) => ({ sheetIndex, name, visibility, rowCount })), [
    { sheetIndex: 1, name: "Payroll Register", visibility: "visible", rowCount: 6 },
    { sheetIndex: 2, name: "Quarterly Totals", visibility: "hidden", rowCount: 2 },
  ]);
  const payrollCells = new Map(result.sheets[0].cells.map((cell) => [cell.cellReference, cell]));
  assert.equal(payrollCells.get("A4").rawValue, "TEST-002");
  assert.equal(payrollCells.get("B3").valueType, "number");
  assert.equal(payrollCells.get("D4").valueType, "boolean");
  assert.deepEqual(
    { rawValue: payrollCells.get("C3").rawValue, formula: payrollCells.get("C3").formula, valueType: payrollCells.get("C3").valueType },
    { rawValue: "125000.00", formula: "SUM(B3:B4)", valueType: "formula" },
  );
  assert.equal(result.sheets[1].cells.find(({ cellReference }) => cellReference === "A2").rawValue, "NOT A TAX FILING");
});

test("spreadsheet resource limits fail closed before any structure is accepted", () => {
  const csvLimited = extractCsvStructure(syntheticGeneralLedgerCsv, { maxCells: 2 });
  const xlsxLimited = extractXlsxStructure(syntheticStructuredWorkbook, { maxSheets: 1 });
  const archiveLimited = extractXlsxStructure(syntheticStructuredWorkbook, { maxArchiveXmlBytes: 100 });

  assert.equal(csvLimited.outcome, "needs_review");
  assert.match(csvLimited.reason, /too many populated cells/i);
  assert.equal(xlsxLimited.outcome, "needs_review");
  assert.match(xlsxLimited.reason, /too many sheets/i);
  assert.equal(archiveLimited.outcome, "needs_review");
  assert.match(archiveLimited.reason, /safe XML processing limit/i);
});

test("malformed CSV quoting fails closed instead of shifting cell references", () => {
  const result = extractCsvStructure(new TextEncoder().encode('Account,"unterminated'));

  assert.equal(result.outcome, "needs_review");
  assert.match(result.reason, /without losing its row and cell structure/i);
});

test("the spreadsheet adapter stores sheet and cell source references separately from the original", async () => {
  const db = createDatabaseRecorder();
  const extract = createSpreadsheetExtractor({
    db,
    objectStore: {
      async get(key) {
        assert.equal(key, xlsxDocument.objectKey);
        return { async arrayBuffer() { return asArrayBuffer(syntheticStructuredWorkbook); } };
      },
    },
  });

  const result = await extract(xlsxDocument);

  assert.equal(result.outcome, "ready");
  assert.equal(db.batches.length, 1);
  assert.equal(db.batches[0].length, 4);
  assert.match(db.batches[0][0].sql, /DELETE FROM document_workbook_cells/);
  assert.match(db.batches[0][1].sql, /DELETE FROM document_workbook_sheets/);
  assert.match(db.batches[0][2].sql, /INSERT INTO document_workbook_sheets/);
  assert.match(db.batches[0][3].sql, /INSERT INTO document_workbook_cells/);
  const storedSheets = JSON.parse(db.batches[0][2].args[0]);
  const storedCells = JSON.parse(db.batches[0][3].args[0]);
  assert.deepEqual(storedSheets.map(({ sheetIndex, name, cellCount }) => ({ sheetIndex, name, cellCount })), [
    { sheetIndex: 1, name: "Payroll Register", cellCount: 8 },
    { sheetIndex: 2, name: "Quarterly Totals", cellCount: 3 },
  ]);
  assert.equal(storedCells.every(({ documentId, auditId, ownerId, sheetId }) =>
    documentId === xlsxDocument.documentId && auditId === xlsxDocument.auditId && ownerId === xlsxDocument.ownerId && Boolean(sheetId)), true);
  const storedFormula = storedCells.find(({ cellReference, sheetIndex }) => cellReference === "C3" && sheetIndex === 1);
  assert.equal(storedFormula.rowNumber, 3);
  assert.equal(storedFormula.columnNumber, 3);
  assert.equal(storedFormula.formula, "SUM(B3:B4)");
});

test("a clean, structurally supported XLSX completes the real extraction lifecycle", async () => {
  const db = createDatabaseRecorder();
  const transitions = [];
  const objectStore = {
    async get() {
      return { async arrayBuffer() { return asArrayBuffer(syntheticStructuredWorkbook); } };
    },
  };
  const extract = createDocumentExtractor({
    extractPdf: async () => { throw new Error("PDF extractor should not run"); },
    extractSpreadsheet: createSpreadsheetExtractor({ db, objectStore }),
  });

  const outcome = await runDocumentLifecycle(xlsxDocument, {
    scan: async () => ({ outcome: "safe" }),
    inspect: createDocumentInspector({ objectStore }),
    extract,
  }, async (from, to, reason) => transitions.push({ from, to, reason }));

  assert.equal(outcome, "ready");
  assert.deepEqual(transitions.map(({ to }) => to), ["scanning", "extracting", "ready"]);
  assert.equal(db.batches.length, 1);
});

test("unsupported documents stop before spreadsheet object access", async () => {
  let objectRead = false;
  const extract = createSpreadsheetExtractor({
    db: createDatabaseRecorder(),
    objectStore: {
      async get() {
        objectRead = true;
        return null;
      },
    },
  });

  const result = await extract({ ...csvDocument, mimeType: "application/pdf" });
  assert.equal(result.outcome, "needs_review");
  assert.match(result.reason, /only for CSV and XLSX/i);
  assert.equal(objectRead, false);
});
