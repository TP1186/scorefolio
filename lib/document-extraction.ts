import type {
  ExtractionResult,
  ProcessingDocument,
} from "./document-processing";

type DocumentExtractor = (document: ProcessingDocument) => Promise<ExtractionResult>;

const CSV_MIMES = new Set(["text/csv", "application/csv"]);
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function createDocumentExtractor({
  extractPdf,
  extractSpreadsheet,
}: {
  extractPdf: DocumentExtractor;
  extractSpreadsheet: DocumentExtractor;
}) {
  return async function extract(document: ProcessingDocument) {
    const mimeType = document.mimeType.toLowerCase();
    return CSV_MIMES.has(mimeType) || mimeType === XLSX_MIME
      ? extractSpreadsheet(document)
      : extractPdf(document);
  };
}
