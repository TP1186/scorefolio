# AuditSentry architecture

## Product boundary

AuditSentry organizes evidence, runs deterministic comparisons, and explains exceptions. It does not independently bind worker status, coverage, rates, classifications, or final premium. Those decisions remain with the carrier and licensed professionals.

## Recommended production stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web application | Next.js, React, TypeScript | Broker and contractor workflows |
| Runtime | Vinext on Cloudflare Workers | Edge-rendered UI and API endpoints |
| Relational data | Cloudflare D1 with Drizzle ORM | Agencies, clients, policies, normalized facts, findings, approvals, packet history |
| Blob storage | Cloudflare R2 | Original documents, OCR derivatives and generated exports |
| Authentication | OIDC/SAML-capable identity provider | Agency membership and role-based access |
| Extraction | OCR plus document-specific parsers | Tables and fields from policy, payroll, tax and certificate records |
| Rules | Versioned deterministic rules | Totals, periods, entity matching, missing evidence and date gaps |
| AI review | Structured LLM output with source citations | Exception summaries, follow-up drafts and reviewer assistance |
| Observability | Structured logs, traces and product analytics | Extraction failures, review latency, workflow conversion and model quality |

## Processing sequence

1. A user uploads an immutable source document.
2. The system writes the binary object to R2 and document metadata to D1.
3. OCR and document-specific parsing produce normalized facts with page and bounding-box provenance.
4. Deterministic checks reconcile totals, dates, names and required evidence.
5. The AI layer receives only relevant extracted facts and source references. It returns a schema-validated finding, never an unstructured autonomous decision.
6. A licensed reviewer resolves, accepts or rejects each finding.
7. Packet generation writes a versioned manifest containing the exact approved sources and open-exception schedule.

## Security baseline

- Encrypt data in transit and at rest.
- Scope every query by agency and client ownership.
- Separate original documents from derived extractions.
- Record immutable audit events for uploads, model results, reviews and exports.
- Redact or tokenize SSNs and bank data before model processing.
- Use short-lived signed URLs for document access.
- Apply retention policies by agency, document class and policy term.
- Require step-up authentication for packet export and submission.
- Complete SOC 2 controls before broad commercial rollout.

## Production integrations

The first integrations should be QuickBooks Online and one payroll provider, followed by agency-management-system imports and ACORD certificate intake. The proof of concept intentionally uses file upload and seeded records so validation does not depend on third-party credentials.
