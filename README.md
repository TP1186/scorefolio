# AuditSentry proof of concept

AuditSentry is a broker-facing workspace for preparing workers’ compensation premium audits. The proof of concept demonstrates the complete decision flow with synthetic data:

- payroll and tax-form reconciliation;
- subcontractor payment and certificate matching;
- source-linked AI findings;
- audit-readiness scoring;
- human resolution workflows;
- an exportable audit-packet manifest; and
- a production architecture and data catalog inside the application.

## Technology

- Next.js 16, React 19 and TypeScript
- Vinext and Cloudflare Workers-compatible output
- Lucide React icons
- Cloudflare D1 + Drizzle ORM recommended for production records
- Cloudflare R2 recommended for source documents and generated packets
- OCR, rules and structured LLM output recommended for the AI pipeline

The deployed proof of concept intentionally uses deterministic, synthetic seed data from `lib/demo-data.ts`. No personal or customer information is transmitted or stored.

## Product boundaries

This is an operational prototype, not insurance, legal, payroll or tax advice. Production classification recommendations and carrier submissions should require approval by a licensed professional. Exposure values in the demonstration are illustrative scenarios.

See `docs/architecture.md` and `docs/data-model.md` for the production blueprint.
