import type {
  DocumentInspectionResult,
  ProcessingDocument,
} from "./document-processing";

type PrivateObjectBody = {
  arrayBuffer(): Promise<ArrayBuffer>;
};

type PrivateObjectStore = {
  get(key: string): Promise<PrivateObjectBody | null>;
};

type DocumentInspectorOptions = {
  objectStore: PrivateObjectStore;
};

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const inspectionReasons = {
  corruptPdf: "This PDF is corrupt or incomplete and was quarantined before extraction.",
  encryptedPdf: "This PDF is password-protected and was quarantined before extraction. Upload an unlocked copy.",
  unsupportedPdf: "This PDF version is not supported and was quarantined before extraction.",
  corruptCsv: "This CSV is empty, corrupt, or not UTF-8 text and was quarantined before extraction.",
  corruptSpreadsheet: "This Excel workbook is corrupt or incomplete and was quarantined before extraction.",
  encryptedSpreadsheet: "This Excel workbook is password-protected and was quarantined before extraction. Upload an unlocked copy.",
  unsupportedSpreadsheet: "This file is not a supported Excel workbook and was quarantined before extraction.",
  unsupportedCompression: "This Excel workbook uses an unsupported compression method and was quarantined before extraction.",
  legacySpreadsheet: "Legacy .xls workbooks are not supported yet and were quarantined before extraction. Save the workbook as .xlsx or CSV.",
  corruptImage: "This image is corrupt or incomplete and was quarantined before extraction.",
  unsupportedType: "This document type is not supported and was quarantined before extraction.",
} as const;

function hasPrefix(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function quarantine(reason: string): DocumentInspectionResult {
  return { outcome: "quarantined", reason };
}

function inspectPdf(bytes: Uint8Array): DocumentInspectionResult {
  const text = new TextDecoder("latin1").decode(bytes);
  const headerIndex = text.slice(0, 1024).indexOf("%PDF-");
  const version = headerIndex >= 0 ? text.slice(headerIndex, headerIndex + 8) : "";
  if (!/^%PDF-[12]\.[0-9]$/.test(version)) {
    return quarantine(headerIndex >= 0 ? inspectionReasons.unsupportedPdf : inspectionReasons.corruptPdf);
  }
  if (!text.slice(Math.max(0, text.length - 1024)).includes("%%EOF")) {
    return quarantine(inspectionReasons.corruptPdf);
  }
  if (/\/Encrypt\b/.test(text)) {
    return quarantine(inspectionReasons.encryptedPdf);
  }
  return { outcome: "supported" };
}

function inspectCsv(bytes: Uint8Array): DocumentInspectionResult {
  if (bytes.length === 0 || bytes.includes(0)) return quarantine(inspectionReasons.corruptCsv);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    return text.trim().length > 0 ? { outcome: "supported" } : quarantine(inspectionReasons.corruptCsv);
  } catch {
    return quarantine(inspectionReasons.corruptCsv);
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) return offset;
  }
  return -1;
}

function inspectXlsx(bytes: Uint8Array): DocumentInspectionResult {
  if (hasPrefix(bytes, OLE_SIGNATURE)) return quarantine(inspectionReasons.encryptedSpreadsheet);
  if (!hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) return quarantine(inspectionReasons.corruptSpreadsheet);

  const eocdOffset = findEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) return quarantine(inspectionReasons.corruptSpreadsheet);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const directorySize = view.getUint32(eocdOffset + 12, true);
  const directoryOffset = view.getUint32(eocdOffset + 16, true);
  const commentLength = view.getUint16(eocdOffset + 20, true);
  if (
    view.getUint16(eocdOffset + 4, true) !== 0 ||
    view.getUint16(eocdOffset + 6, true) !== 0 ||
    view.getUint16(eocdOffset + 8, true) !== entryCount ||
    entryCount === 0 ||
    directoryOffset + directorySize !== eocdOffset ||
    eocdOffset + 22 + commentLength !== bytes.length
  ) {
    return quarantine(inspectionReasons.corruptSpreadsheet);
  }

  const names = new Set<string>();
  let offset = directoryOffset;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > eocdOffset || view.getUint32(offset, true) !== 0x02014b50) {
      return quarantine(inspectionReasons.corruptSpreadsheet);
    }
    const flags = view.getUint16(offset + 8, true);
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > eocdOffset) return quarantine(inspectionReasons.corruptSpreadsheet);
    if ((flags & 0x0001) !== 0) return quarantine(inspectionReasons.encryptedSpreadsheet);
    if (compression !== 0 && compression !== 8) return quarantine(inspectionReasons.unsupportedCompression);
    if (localOffset + 30 > directoryOffset || view.getUint32(localOffset, true) !== 0x04034b50) {
      return quarantine(inspectionReasons.corruptSpreadsheet);
    }
    const localFlags = view.getUint16(localOffset + 6, true);
    const localCompression = view.getUint16(localOffset + 8, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const localDataEnd = localOffset + 30 + localNameLength + localExtraLength + compressedSize;
    if ((localFlags & 0x0001) !== 0) return quarantine(inspectionReasons.encryptedSpreadsheet);
    if (localCompression !== compression || localDataEnd > directoryOffset) {
      return quarantine(inspectionReasons.corruptSpreadsheet);
    }
    try {
      const name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
      const localName = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength),
      );
      if (name !== localName) return quarantine(inspectionReasons.corruptSpreadsheet);
      names.add(name);
    } catch {
      return quarantine(inspectionReasons.corruptSpreadsheet);
    }
    offset = nextOffset;
  }

  if (offset !== directoryOffset + directorySize) return quarantine(inspectionReasons.corruptSpreadsheet);
  const requiredEntries = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"];
  return requiredEntries.every((name) => names.has(name))
    ? { outcome: "supported" }
    : quarantine(inspectionReasons.unsupportedSpreadsheet);
}

function inspectPng(bytes: Uint8Array): DocumentInspectionResult {
  if (!hasPrefix(bytes, PNG_SIGNATURE) || bytes.length < 33) return quarantine(inspectionReasons.corruptImage);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  let firstChunk = true;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const end = offset + 12 + length;
    if (end > bytes.length) return quarantine(inspectionReasons.corruptImage);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (firstChunk && (type !== "IHDR" || length !== 13)) return quarantine(inspectionReasons.corruptImage);
    if (type === "IEND") return length === 0 && end === bytes.length
      ? { outcome: "supported" }
      : quarantine(inspectionReasons.corruptImage);
    firstChunk = false;
    offset = end;
  }
  return quarantine(inspectionReasons.corruptImage);
}

function inspectJpeg(bytes: Uint8Array): DocumentInspectionResult {
  if (bytes.length < 4 || !hasPrefix(bytes, [0xff, 0xd8]) || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    return quarantine(inspectionReasons.corruptImage);
  }
  let offset = 2;
  while (offset < bytes.length - 2) {
    if (bytes[offset] !== 0xff) return quarantine(inspectionReasons.corruptImage);
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xda) {
      if (offset + 2 > bytes.length - 2) return quarantine(inspectionReasons.corruptImage);
      const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
      return segmentLength >= 2 && offset + segmentLength <= bytes.length - 2
        ? { outcome: "supported" }
        : quarantine(inspectionReasons.corruptImage);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length - 2) return quarantine(inspectionReasons.corruptImage);
    const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length - 2) {
      return quarantine(inspectionReasons.corruptImage);
    }
    offset += segmentLength;
  }
  return quarantine(inspectionReasons.corruptImage);
}

export function inspectDocumentBytes(mimeType: string, bytes: Uint8Array): DocumentInspectionResult {
  switch (mimeType.toLowerCase()) {
    case "application/pdf":
      return inspectPdf(bytes);
    case "text/csv":
    case "application/csv":
      return inspectCsv(bytes);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return inspectXlsx(bytes);
    case "application/vnd.ms-excel":
      return hasPrefix(bytes, OLE_SIGNATURE)
        ? quarantine(inspectionReasons.legacySpreadsheet)
        : quarantine(inspectionReasons.corruptSpreadsheet);
    case "image/png":
      return inspectPng(bytes);
    case "image/jpeg":
      return inspectJpeg(bytes);
    default:
      return quarantine(inspectionReasons.unsupportedType);
  }
}

export function createDocumentInspector({ objectStore }: DocumentInspectorOptions) {
  return async function inspect(document: ProcessingDocument): Promise<DocumentInspectionResult> {
    const storedObject = await objectStore.get(document.objectKey);
    if (!storedObject) throw new Error("Uploaded object is unavailable in private storage");
    return inspectDocumentBytes(document.mimeType, new Uint8Array(await storedObject.arrayBuffer()));
  };
}
