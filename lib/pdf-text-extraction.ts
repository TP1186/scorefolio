import { extractText, getDocumentProxy } from "unpdf";
import type {
  ExtractionResult,
  ProcessingDocument,
} from "./document-processing";

type PrivateObjectBody = {
  arrayBuffer(): Promise<ArrayBuffer>;
};

type PrivateObjectStore = {
  get(key: string): Promise<PrivateObjectBody | null>;
};

type ExtractionDatabase = Pick<D1Database, "batch" | "prepare">;

type NativePdfExtractorOptions = {
  db: ExtractionDatabase;
  objectStore: PrivateObjectStore;
  maxPages?: number;
  maxTextCharacters?: number;
  timeoutMs?: number;
};

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

type NativePdfTextResult =
  | { outcome: "ready"; pages: ExtractedPdfPage[] }
  | { outcome: "needs_review"; reason: string };

const DEFAULT_MAX_PAGES = 200;
const DEFAULT_MAX_TEXT_CHARACTERS = 1_000_000;
const DEFAULT_EXTRACTION_TIMEOUT_MS = 20_000;

const extractionReasons = {
  unsupportedType: "Native text extraction is currently available only for PDF documents.",
  pageLimit: "This PDF has too many pages for automatic text extraction and needs review.",
  textLimit: "This PDF contains too much text for automatic extraction and needs review.",
  noText: "No native text layer was found. This PDF may be scanned and needs OCR review.",
  timeout: "PDF text extraction timed out and needs review.",
  failed: "Native PDF text could not be extracted and needs review.",
} as const;

class ExtractionTimeoutError extends Error {
  constructor() {
    super("PDF text extraction timed out");
    this.name = "ExtractionTimeoutError";
  }
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new ExtractionTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function extractNativePdfText(
  bytes: Uint8Array,
  options: {
    maxPages?: number;
    maxTextCharacters?: number;
    timeoutMs?: number;
  } = {},
): Promise<NativePdfTextResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxTextCharacters = options.maxTextCharacters ?? DEFAULT_MAX_TEXT_CHARACTERS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS;
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;

  try {
    // PDF.js may transfer the supplied buffer. Keep the caller's private-object
    // bytes intact because inspection and test fixtures can share the same data.
    pdf = await withTimeout(getDocumentProxy(bytes.slice()), timeoutMs);
    if (pdf.numPages > maxPages) {
      return { outcome: "needs_review", reason: extractionReasons.pageLimit };
    }

    const extracted = await withTimeout(extractText(pdf, { mergePages: false }), timeoutMs);
    const pages = extracted.text.map((text, index) => ({
      pageNumber: index + 1,
      text: text.trim(),
    }));
    const totalCharacters = pages.reduce((total, page) => total + page.text.length, 0);
    if (totalCharacters > maxTextCharacters) {
      return { outcome: "needs_review", reason: extractionReasons.textLimit };
    }
    if (!pages.some((page) => page.text.length > 0)) {
      return { outcome: "needs_review", reason: extractionReasons.noText };
    }
    return { outcome: "ready", pages };
  } catch (error) {
    return {
      outcome: "needs_review",
      reason: error instanceof ExtractionTimeoutError ? extractionReasons.timeout : extractionReasons.failed,
    };
  } finally {
    const destroy = (pdf as { destroy?: () => Promise<void> } | undefined)?.destroy;
    if (destroy) await destroy.call(pdf);
  }
}

export function createNativePdfExtractor({
  db,
  objectStore,
  maxPages,
  maxTextCharacters,
  timeoutMs,
}: NativePdfExtractorOptions) {
  return async function extract(document: ProcessingDocument): Promise<ExtractionResult> {
    if (document.mimeType.toLowerCase() !== "application/pdf") {
      return { outcome: "needs_review", reason: extractionReasons.unsupportedType };
    }

    const storedObject = await objectStore.get(document.objectKey);
    if (!storedObject) throw new Error("Uploaded object is unavailable in private storage");
    const result = await extractNativePdfText(
      new Uint8Array(await storedObject.arrayBuffer()),
      { maxPages, maxTextCharacters, timeoutMs },
    );
    if (result.outcome !== "ready") return result;

    const now = Date.now();
    await db.batch([
      db.prepare("DELETE FROM document_text_pages WHERE document_id = ? AND owner_id = ?")
        .bind(document.documentId, document.ownerId),
      ...result.pages.map((page) => db.prepare(
        `INSERT INTO document_text_pages
         (id, document_id, audit_id, owner_id, page_number, text, character_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(),
        document.documentId,
        document.auditId,
        document.ownerId,
        page.pageNumber,
        page.text,
        page.text.length,
        now,
      )),
    ]);

    return { outcome: "ready" };
  };
}
