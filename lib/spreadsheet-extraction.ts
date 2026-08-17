import { XMLParser } from "fast-xml-parser";
import { unzipSync } from "fflate";
import type {
  ExtractionResult,
  ProcessingDocument,
} from "./document-processing";
import { redactSocialSecurityNumbers } from "./pii-redaction.ts";

type PrivateObjectBody = {
  arrayBuffer(): Promise<ArrayBuffer>;
};

type PrivateObjectStore = {
  get(key: string): Promise<PrivateObjectBody | null>;
};

type ExtractionDatabase = Pick<D1Database, "batch" | "prepare">;

type SpreadsheetExtractorOptions = SpreadsheetLimits & {
  db: ExtractionDatabase;
  objectStore: PrivateObjectStore;
};

type SpreadsheetLimits = {
  maxSheets?: number;
  maxRowsPerSheet?: number;
  maxColumns?: number;
  maxCells?: number;
  maxValueCharacters?: number;
  maxTotalValueCharacters?: number;
  maxArchiveXmlBytes?: number;
};

export type ExtractedSpreadsheetCell = {
  rowNumber: number;
  columnNumber: number;
  cellReference: string;
  valueType: "text" | "number" | "boolean" | "date" | "error" | "formula";
  rawValue: string | null;
  formula: string | null;
  redactionCount: number;
};

export type ExtractedSpreadsheetSheet = {
  sheetIndex: number;
  name: string;
  visibility: "visible" | "hidden" | "veryHidden";
  rowCount: number;
  redactionCount: number;
  cells: ExtractedSpreadsheetCell[];
};

type SpreadsheetExtractionResult =
  | { outcome: "ready"; sheets: ExtractedSpreadsheetSheet[] }
  | { outcome: "needs_review"; reason: string };

type XmlObject = Record<string, unknown>;

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const CSV_MIMES = new Set(["text/csv", "application/csv"]);
const DEFAULT_MAX_SHEETS = 50;
const DEFAULT_MAX_ROWS_PER_SHEET = 100_000;
const DEFAULT_MAX_COLUMNS = 16_384;
const DEFAULT_MAX_CELLS = 25_000;
const DEFAULT_MAX_VALUE_CHARACTERS = 50_000;
const DEFAULT_MAX_TOTAL_VALUE_CHARACTERS = 1_000_000;
const DEFAULT_MAX_ARCHIVE_XML_BYTES = 12_000_000;

const extractionReasons = {
  unsupportedType: "Structured spreadsheet extraction is available only for CSV and XLSX documents.",
  invalidCsv: "This CSV could not be parsed without losing its row and cell structure and needs review.",
  invalidWorkbook: "This Excel workbook could not be parsed without losing its sheet and cell structure and needs review.",
  sheetLimit: "This workbook contains too many sheets for automatic extraction and needs review.",
  rowLimit: "This spreadsheet contains too many rows for automatic extraction and needs review.",
  columnLimit: "This spreadsheet contains a cell outside the supported column limit and needs review.",
  cellLimit: "This spreadsheet contains too many populated cells for automatic extraction and needs review.",
  valueLimit: "This spreadsheet contains a cell value that is too large for automatic extraction and needs review.",
  textLimit: "This spreadsheet contains too much extracted text for automatic extraction and needs review.",
  archiveLimit: "This Excel workbook expands beyond the safe XML processing limit and needs review.",
} as const;

class SpreadsheetReviewError extends Error {
  reason: string;

  constructor(reason: string) {
    super(reason);
    this.reason = reason;
    this.name = "SpreadsheetReviewError";
  }
}

function limitValue(value: number | undefined, fallback: number) {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function resolveLimits(options: SpreadsheetLimits) {
  return {
    maxSheets: limitValue(options.maxSheets, DEFAULT_MAX_SHEETS),
    maxRowsPerSheet: limitValue(options.maxRowsPerSheet, DEFAULT_MAX_ROWS_PER_SHEET),
    maxColumns: limitValue(options.maxColumns, DEFAULT_MAX_COLUMNS),
    maxCells: limitValue(options.maxCells, DEFAULT_MAX_CELLS),
    maxValueCharacters: limitValue(options.maxValueCharacters, DEFAULT_MAX_VALUE_CHARACTERS),
    maxTotalValueCharacters: limitValue(options.maxTotalValueCharacters, DEFAULT_MAX_TOTAL_VALUE_CHARACTERS),
    maxArchiveXmlBytes: limitValue(options.maxArchiveXmlBytes, DEFAULT_MAX_ARCHIVE_XML_BYTES),
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function asObject(value: unknown): XmlObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as XmlObject : {};
}

function asString(value: unknown) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return asString(asObject(value)["#text"]);
}

function collectRichText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(collectRichText).join("");
  const node = asObject(value);
  if (node.t !== undefined) return collectRichText(node.t);
  if (node.r !== undefined) return collectRichText(node.r);
  return asString(node["#text"]);
}

function columnLabel(columnNumber: number) {
  let label = "";
  for (let value = columnNumber; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  }
  return label;
}

function parseCellReference(reference: string) {
  const match = /^([A-Z]{1,3})([1-9][0-9]*)$/.exec(reference.toUpperCase());
  if (!match) return null;
  let columnNumber = 0;
  for (const character of match[1]) columnNumber = columnNumber * 26 + character.charCodeAt(0) - 64;
  const rowNumber = Number(match[2]);
  return Number.isSafeInteger(rowNumber) ? { columnNumber, rowNumber } : null;
}

function validateCell(
  cell: ExtractedSpreadsheetCell,
  counters: { cells: number; characters: number },
  limits: ReturnType<typeof resolveLimits>,
) {
  if (cell.rowNumber > limits.maxRowsPerSheet) throw new SpreadsheetReviewError(extractionReasons.rowLimit);
  if (cell.columnNumber > limits.maxColumns) throw new SpreadsheetReviewError(extractionReasons.columnLimit);
  const valueCharacters = (cell.rawValue?.length ?? 0) + (cell.formula?.length ?? 0);
  if (valueCharacters > limits.maxValueCharacters) throw new SpreadsheetReviewError(extractionReasons.valueLimit);
  counters.cells += 1;
  counters.characters += valueCharacters;
  if (counters.cells > limits.maxCells) throw new SpreadsheetReviewError(extractionReasons.cellLimit);
  if (counters.characters > limits.maxTotalValueCharacters) throw new SpreadsheetReviewError(extractionReasons.textLimit);
}

function redactCell(
  cell: Omit<ExtractedSpreadsheetCell, "redactionCount">,
): ExtractedSpreadsheetCell {
  const rawValue = cell.rawValue === null
    ? null
    : redactSocialSecurityNumbers(cell.rawValue);
  const formula = cell.formula === null
    ? null
    : redactSocialSecurityNumbers(cell.formula);
  return {
    ...cell,
    rawValue: rawValue?.text ?? null,
    formula: formula?.text ?? null,
    redactionCount: (rawValue?.redactionCount ?? 0) + (formula?.redactionCount ?? 0),
  };
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let justClosedQuote = false;
  let endedOnRowBreak = false;

  const pushValue = () => {
    row.push(value);
    value = "";
    justClosedQuote = false;
  };
  const pushRow = () => {
    pushValue();
    rows.push(row);
    row = [];
    endedOnRowBreak = true;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          justClosedQuote = true;
        }
      } else {
        value += character;
      }
      endedOnRowBreak = false;
      continue;
    }

    if (justClosedQuote && character !== "," && character !== "\r" && character !== "\n") {
      throw new SpreadsheetReviewError(extractionReasons.invalidCsv);
    }
    if (character === '"') {
      if (value.length > 0) throw new SpreadsheetReviewError(extractionReasons.invalidCsv);
      quoted = true;
      endedOnRowBreak = false;
    } else if (character === ",") {
      pushValue();
      endedOnRowBreak = false;
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      pushRow();
    } else {
      value += character;
      endedOnRowBreak = false;
    }
  }

  if (quoted) throw new SpreadsheetReviewError(extractionReasons.invalidCsv);
  if (!endedOnRowBreak || row.length > 0 || value.length > 0) pushRow();
  return rows;
}

export function extractCsvStructure(
  bytes: Uint8Array,
  options: SpreadsheetLimits = {},
): SpreadsheetExtractionResult {
  const limits = resolveLimits(options);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    const rows = parseCsvRows(text);
    if (rows.length > limits.maxRowsPerSheet) throw new SpreadsheetReviewError(extractionReasons.rowLimit);
    const counters = { cells: 0, characters: 0 };
    const cells: ExtractedSpreadsheetCell[] = [];
    rows.forEach((row, rowIndex) => {
      if (row.length > limits.maxColumns) throw new SpreadsheetReviewError(extractionReasons.columnLimit);
      row.forEach((rawValue, columnIndex) => {
        if (rawValue.length === 0) return;
        const unredactedCell = {
          rowNumber: rowIndex + 1,
          columnNumber: columnIndex + 1,
          cellReference: `${columnLabel(columnIndex + 1)}${rowIndex + 1}`,
          valueType: "text",
          rawValue,
          formula: null,
        };
        validateCell({ ...unredactedCell, redactionCount: 0 }, counters, limits);
        cells.push(redactCell(unredactedCell));
      });
    });
    return {
      outcome: "ready",
      sheets: [{ sheetIndex: 1, name: "CSV", visibility: "visible", rowCount: rows.length, redactionCount: 0, cells }],
    };
  } catch (error) {
    return {
      outcome: "needs_review",
      reason: error instanceof SpreadsheetReviewError ? error.reason : extractionReasons.invalidCsv,
    };
  }
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: false,
  processEntities: {
    enabled: true,
    maxEntitySize: 1_000,
    maxExpansionDepth: 2,
    maxTotalExpansions: 100,
    maxExpandedLength: 100_000,
    maxEntityCount: 20,
  },
  maxNestedTags: 100,
});

function parseXml(bytes: Uint8Array) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
  return asObject(xmlParser.parse(text));
}

function shouldExtractArchiveEntry(name: string) {
  return name === "xl/workbook.xml" ||
    name === "xl/_rels/workbook.xml.rels" ||
    name === "xl/sharedStrings.xml" ||
    /^xl\/worksheets\/[^/]+\.xml$/.test(name);
}

function resolveWorksheetPath(target: string) {
  if (!target || target.includes("\\") || target.includes("\0")) return null;
  try {
    const path = new URL(target, "https://xlsx.invalid/xl/workbook.xml").pathname.replace(/^\//, "");
    return /^xl\/worksheets\/[^/]+\.xml$/.test(path) ? path : null;
  } catch {
    return null;
  }
}

function parseSharedStrings(files: Record<string, Uint8Array>) {
  const bytes = files["xl/sharedStrings.xml"];
  if (!bytes) return [];
  const root = asObject(parseXml(bytes).sst);
  return asArray(root.si).map(collectRichText);
}

function readXlsxCell(
  node: XmlObject,
  sharedStrings: string[],
): Omit<ExtractedSpreadsheetCell, "rowNumber" | "columnNumber" | "cellReference"> | null {
  const dataType = asString(node["@_t"]);
  const formula = node.f === undefined ? null : collectRichText(node.f);
  const inlineValue = node.is === undefined ? null : collectRichText(node.is);
  const storedValue = node.v === undefined ? null : asString(node.v);
  if (formula === null && inlineValue === null && storedValue === null) return null;

  let rawValue = inlineValue ?? storedValue;
  let valueType: ExtractedSpreadsheetCell["valueType"] = formula !== null ? "formula" : "number";
  if (dataType === "s") {
    const sharedIndex = Number(storedValue);
    if (!Number.isInteger(sharedIndex) || sharedIndex < 0 || sharedIndex >= sharedStrings.length) {
      throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
    }
    rawValue = sharedStrings[sharedIndex];
    valueType = formula !== null ? "formula" : "text";
  } else if (dataType === "inlineStr" || dataType === "str") {
    valueType = formula !== null ? "formula" : "text";
  } else if (dataType === "b") {
    if (storedValue !== "0" && storedValue !== "1") throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
    valueType = formula !== null ? "formula" : "boolean";
  } else if (dataType === "d") {
    valueType = formula !== null ? "formula" : "date";
  } else if (dataType === "e") {
    valueType = formula !== null ? "formula" : "error";
  } else if (dataType && dataType !== "n") {
    throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
  }
  return { valueType, rawValue, formula };
}

export function extractXlsxStructure(
  bytes: Uint8Array,
  options: SpreadsheetLimits = {},
): SpreadsheetExtractionResult {
  const limits = resolveLimits(options);
  try {
    let selectedXmlBytes = 0;
    const files = unzipSync(bytes, {
      filter(entry) {
        if (!shouldExtractArchiveEntry(entry.name)) return false;
        selectedXmlBytes += entry.originalSize;
        if (entry.originalSize > limits.maxArchiveXmlBytes || selectedXmlBytes > limits.maxArchiveXmlBytes) {
          throw new SpreadsheetReviewError(extractionReasons.archiveLimit);
        }
        return true;
      },
    });
    const workbookBytes = files["xl/workbook.xml"];
    const relationshipsBytes = files["xl/_rels/workbook.xml.rels"];
    if (!workbookBytes || !relationshipsBytes) throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);

    const workbook = asObject(parseXml(workbookBytes).workbook);
    const sheetNodes = asArray(asObject(workbook.sheets).sheet).map(asObject);
    if (sheetNodes.length === 0) throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
    if (sheetNodes.length > limits.maxSheets) throw new SpreadsheetReviewError(extractionReasons.sheetLimit);

    const relationships = asArray(asObject(parseXml(relationshipsBytes).Relationships).Relationship).map(asObject);
    const worksheetPaths = new Map<string, string>();
    for (const relationship of relationships) {
      if (asString(relationship["@_TargetMode"]).toLowerCase() === "external") continue;
      const id = asString(relationship["@_Id"]);
      const type = asString(relationship["@_Type"]);
      const path = type.endsWith("/worksheet") ? resolveWorksheetPath(asString(relationship["@_Target"])) : null;
      if (id && path) worksheetPaths.set(id, path);
    }

    const sharedStrings = parseSharedStrings(files);
    const counters = { cells: 0, characters: 0 };
    const names = new Set<string>();
    const sheets = sheetNodes.map((sheetNode, sheetOffset): ExtractedSpreadsheetSheet => {
      const name = asString(sheetNode["@_name"]);
      const relationshipId = asString(sheetNode["@_r:id"]);
      const path = worksheetPaths.get(relationshipId);
      if (!name || names.has(name) || !path || !files[path]) {
        throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
      }
      names.add(name);
      const state = asString(sheetNode["@_state"]);
      const visibility = state === "hidden" || state === "veryHidden" ? state : "visible";
      const worksheet = asObject(parseXml(files[path]).worksheet);
      const rowNodes = asArray(asObject(worksheet.sheetData).row).map(asObject);
      const cells: ExtractedSpreadsheetCell[] = [];
      let highestRowNumber = 0;
      const references = new Set<string>();
      const rowNumbers = new Set<number>();
      for (const rowNode of rowNodes) {
        const rawRowNumber = asString(rowNode["@_r"]);
        const rowNumber = rawRowNumber ? Number(rawRowNumber) : null;
        if (rowNumber !== null) {
          if (!Number.isSafeInteger(rowNumber) || rowNumber < 1 || rowNumber > limits.maxRowsPerSheet || rowNumbers.has(rowNumber)) {
            throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
          }
          rowNumbers.add(rowNumber);
          highestRowNumber = Math.max(highestRowNumber, rowNumber);
        }
        for (const cellNode of asArray(rowNode.c).map(asObject)) {
          const reference = asString(cellNode["@_r"]).toUpperCase();
          const position = parseCellReference(reference);
          if (!position || references.has(reference) || (rowNumber !== null && position.rowNumber !== rowNumber)) {
            throw new SpreadsheetReviewError(extractionReasons.invalidWorkbook);
          }
          references.add(reference);
          const value = readXlsxCell(cellNode, sharedStrings);
          if (!value) continue;
          const unredactedCell = { ...position, cellReference: reference, ...value };
          validateCell({ ...unredactedCell, redactionCount: 0 }, counters, limits);
          highestRowNumber = Math.max(highestRowNumber, position.rowNumber);
          cells.push(redactCell(unredactedCell));
        }
      }
      const redactedName = redactSocialSecurityNumbers(name);
      return {
        sheetIndex: sheetOffset + 1,
        name: redactedName.text,
        visibility,
        rowCount: highestRowNumber,
        redactionCount: redactedName.redactionCount,
        cells,
      };
    });
    return { outcome: "ready", sheets };
  } catch (error) {
    return {
      outcome: "needs_review",
      reason: error instanceof SpreadsheetReviewError ? error.reason : extractionReasons.invalidWorkbook,
    };
  }
}

function serializeSheetRows(
  document: ProcessingDocument,
  sheets: ExtractedSpreadsheetSheet[],
  now: number,
) {
  return sheets.map((sheet) => ({
    id: crypto.randomUUID(),
    documentId: document.documentId,
    auditId: document.auditId,
    ownerId: document.ownerId,
    sheetIndex: sheet.sheetIndex,
    name: sheet.name,
    visibility: sheet.visibility,
    rowCount: sheet.rowCount,
    cellCount: sheet.cells.length,
    redactionCount: sheet.redactionCount,
    createdAt: now,
  }));
}

export function createSpreadsheetExtractor({
  db,
  objectStore,
  ...limitOptions
}: SpreadsheetExtractorOptions) {
  return async function extract(document: ProcessingDocument): Promise<ExtractionResult> {
    const mimeType = document.mimeType.toLowerCase();
    if (!CSV_MIMES.has(mimeType) && mimeType !== XLSX_MIME) {
      return { outcome: "needs_review", reason: extractionReasons.unsupportedType };
    }

    const storedObject = await objectStore.get(document.objectKey);
    if (!storedObject) throw new Error("Uploaded object is unavailable in private storage");
    const bytes = new Uint8Array(await storedObject.arrayBuffer());
    const result = CSV_MIMES.has(mimeType)
      ? extractCsvStructure(bytes, limitOptions)
      : extractXlsxStructure(bytes, limitOptions);
    if (result.outcome !== "ready") return result;

    const now = Date.now();
    const sheetRows = serializeSheetRows(document, result.sheets, now);
    const sheetIds = new Map(sheetRows.map((sheet) => [sheet.sheetIndex, sheet.id]));
    const cellRows = result.sheets.flatMap((sheet) => sheet.cells.map((cell) => ({
      id: crypto.randomUUID(),
      documentId: document.documentId,
      sheetId: sheetIds.get(sheet.sheetIndex),
      auditId: document.auditId,
      ownerId: document.ownerId,
      sheetIndex: sheet.sheetIndex,
      rowNumber: cell.rowNumber,
      columnNumber: cell.columnNumber,
      cellReference: cell.cellReference,
      valueType: cell.valueType,
      rawValue: cell.rawValue,
      formula: cell.formula,
      redactionCount: cell.redactionCount,
      createdAt: now,
    })));

    await db.batch([
      db.prepare("DELETE FROM document_workbook_cells WHERE document_id = ? AND owner_id = ?")
        .bind(document.documentId, document.ownerId),
      db.prepare("DELETE FROM document_workbook_sheets WHERE document_id = ? AND owner_id = ?")
        .bind(document.documentId, document.ownerId),
      db.prepare(
        `INSERT INTO document_workbook_sheets
         (id, document_id, audit_id, owner_id, sheet_index, name, visibility, row_count, cell_count, redaction_count, created_at)
         SELECT
           json_extract(value, '$.id'), json_extract(value, '$.documentId'), json_extract(value, '$.auditId'),
           json_extract(value, '$.ownerId'), CAST(json_extract(value, '$.sheetIndex') AS INTEGER),
           json_extract(value, '$.name'), json_extract(value, '$.visibility'),
           CAST(json_extract(value, '$.rowCount') AS INTEGER), CAST(json_extract(value, '$.cellCount') AS INTEGER),
           CAST(json_extract(value, '$.redactionCount') AS INTEGER),
           CAST(json_extract(value, '$.createdAt') AS INTEGER)
         FROM json_each(?)`,
      ).bind(JSON.stringify(sheetRows)),
      db.prepare(
        `INSERT INTO document_workbook_cells
         (id, document_id, sheet_id, audit_id, owner_id, sheet_index, row_number, column_number,
          cell_reference, value_type, raw_value, formula, redaction_count, created_at)
         SELECT
           json_extract(value, '$.id'), json_extract(value, '$.documentId'), json_extract(value, '$.sheetId'),
           json_extract(value, '$.auditId'), json_extract(value, '$.ownerId'),
           CAST(json_extract(value, '$.sheetIndex') AS INTEGER), CAST(json_extract(value, '$.rowNumber') AS INTEGER),
           CAST(json_extract(value, '$.columnNumber') AS INTEGER), json_extract(value, '$.cellReference'),
           json_extract(value, '$.valueType'), json_extract(value, '$.rawValue'), json_extract(value, '$.formula'),
           CAST(json_extract(value, '$.redactionCount') AS INTEGER),
           CAST(json_extract(value, '$.createdAt') AS INTEGER)
         FROM json_each(?)`,
      ).bind(JSON.stringify(cellRows)),
    ]);

    return { outcome: "ready" };
  };
}
