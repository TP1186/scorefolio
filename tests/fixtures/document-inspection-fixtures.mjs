function littleEndian(value, length) {
  return Array.from({ length }, (_, index) => (value >>> (index * 8)) & 0xff);
}

function zipFixture(names, { encrypted = false, compression = 0 } = {}) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const name of names) {
    const nameBytes = [...encoder.encode(name)];
    const flags = encrypted ? 1 : 0;
    const local = [
      0x50, 0x4b, 0x03, 0x04, 20, 0, ...littleEndian(flags, 2), ...littleEndian(compression, 2),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...littleEndian(nameBytes.length, 2), 0, 0,
      ...nameBytes,
    ];
    localParts.push(...local);
    centralParts.push(
      0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, ...littleEndian(flags, 2), ...littleEndian(compression, 2),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...littleEndian(nameBytes.length, 2),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...littleEndian(localOffset, 4), ...nameBytes,
    );
    localOffset += local.length;
  }

  const directoryOffset = localParts.length;
  return Uint8Array.from([
    ...localParts,
    ...centralParts,
    0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0,
    ...littleEndian(names.length, 2), ...littleEndian(names.length, 2),
    ...littleEndian(centralParts.length, 4), ...littleEndian(directoryOffset, 4), 0, 0,
  ]);
}

const xlsxEntries = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"];

export const supportedPdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
export const passwordProtectedPdf = new TextEncoder().encode("%PDF-1.7\ntrailer<</Encrypt 2 0 R>>\n%%EOF");
export const corruptPdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj");
export const supportedXlsx = zipFixture(xlsxEntries);
export const passwordProtectedXlsx = zipFixture(xlsxEntries, { encrypted: true });
export const unsupportedZip = zipFixture(["word/document.xml"]);
export const corruptXlsx = supportedXlsx.subarray(0, supportedXlsx.length - 8);
export const unsupportedCompressionXlsx = zipFixture(xlsxEntries, { compression: 99 });
export const legacyXls = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
export const supportedCsv = new TextEncoder().encode("employee,gross_wages\nSynthetic Employee,1234.56\n");
export const corruptCsv = Uint8Array.from([0x65, 0x6d, 0x00, 0x70]);
export const supportedPng = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0,
]);
export const corruptPng = supportedPng.subarray(0, supportedPng.length - 12);
export const supportedJpeg = Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, 0, 4, 0, 0,
  0xff, 0xda, 0, 2,
  0xff, 0xd9,
]);
export const corruptJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 10, 0xff, 0xd9]);
