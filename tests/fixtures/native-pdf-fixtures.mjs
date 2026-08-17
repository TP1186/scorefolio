const encoder = new TextEncoder();

function escapePdfText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function createSyntheticNativePdf(pages) {
  const pageCount = pages.length;
  const fontObjectNumber = 3 + (pageCount * 2);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_page, index) => `${3 + (index * 2)} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  ];

  for (const [pageIndex, lines] of pages.entries()) {
    const pageObjectNumber = 3 + (pageIndex * 2);
    const contentObjectNumber = pageObjectNumber + 1;
    const commands = lines.map((line, lineIndex) => (
      `${lineIndex === 0 ? "72 720 Td" : "0 -18 Td"} (${escapePdfText(line)}) Tj`
    )).join("\n");
    const stream = `BT\n/F1 12 Tf\n${commands}\nET`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`,
      `<< /Length ${encoder.encode(stream).byteLength} >>\nstream\n${stream}\nendstream`,
    );
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.7\n% Synthetic AuditSentry fixture\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(encoder.encode(pdf).byteLength);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(pdf);
}

export const syntheticPayrollPdf = createSyntheticNativePdf([
  [
    "SYNTHETIC PAYROLL REGISTER - NOT CUSTOMER DATA",
    "Policy period total gross wages: 125000.00",
    "Source: synthetic payroll fixture",
  ],
  [
    "SYNTHETIC PAYROLL DETAIL",
    "Privacy-safe employee TEST-001 gross wages: 62500.00",
    "Privacy-safe employee TEST-002 gross wages: 62500.00",
  ],
]);

export const syntheticForm941Pdf = createSyntheticNativePdf([
  [
    "SYNTHETIC FORM 941 TEST FIXTURE - NOT A TAX FILING",
    "Quarter 1 wages: 31250.00",
  ],
  [
    "SYNTHETIC FORM 941 CONTINUATION",
    "Quarter 1 fixture control total: 31250.00",
  ],
]);

export const syntheticScannedPdf = createSyntheticNativePdf([[]]);
