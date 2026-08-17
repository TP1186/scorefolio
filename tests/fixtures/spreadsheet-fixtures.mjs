import { strToU8, zipSync } from "fflate";

export const syntheticGeneralLedgerCsv = strToU8([
  "SYNTHETIC GENERAL LEDGER - NOT CUSTOMER DATA",
  "Account,Description,Amount",
  '5000,"Synthetic labor, regular",125000.00',
  "",
  "5100,Synthetic subcontractors,22000.00",
].join("\r\n"));

const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Payroll Register" sheetId="1" r:id="rId1"/>
    <sheet name="Quarterly Totals" sheetId="2" state="hidden" r:id="rId2"/>
  </sheets>
</workbook>`;

const workbookRelationshipsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;

const sharedStringsXml = `<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
  <si><t>SYNTHETIC PAYROLL REGISTER - NOT CUSTOMER DATA</t></si>
  <si><t>Gross Wages</t></si>
  <si><t>TEST-001</t></si>
  <si><r><t>TEST-</t></r><r><t>002</t></r></si>
  <si><t>Quarter 1</t></si>
  <si><t>Synthetic SSN 987-65-4321</t></si>
</sst>`;

const payrollSheetXml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
    <row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3" t="n"><v>62500.00</v></c><c r="C3"><f>SUM(B3:B4)</f><v>125000.00</v></c></row>
    <row r="4"><c r="A4" t="s"><v>3</v></c><c r="B4"><v>62500.00</v></c><c r="D4" t="b"><v>1</v></c></row>
    <row r="5"><c r="A5" t="s"><v>5</v></c></row>
    <row r="6"/>
  </sheetData>
</worksheet>`;

const quarterlySheetXml = `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="2"><c r="A2" t="inlineStr"><is><t>NOT A TAX FILING</t></is></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>125000.00</v></c></row>
  </sheetData>
</worksheet>`;

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;

const rootRelationshipsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

export const syntheticStructuredWorkbook = zipSync({
  "[Content_Types].xml": strToU8(contentTypesXml),
  "_rels/.rels": strToU8(rootRelationshipsXml),
  "xl/workbook.xml": strToU8(workbookXml),
  "xl/_rels/workbook.xml.rels": strToU8(workbookRelationshipsXml),
  "xl/sharedStrings.xml": strToU8(sharedStringsXml),
  "xl/worksheets/sheet1.xml": strToU8(payrollSheetXml),
  "xl/worksheets/sheet2.xml": strToU8(quarterlySheetXml),
}, { level: 6 });
