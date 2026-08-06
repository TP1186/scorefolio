# AuditSentry secure audit portal

AuditSentry helps a small business prepare for a workers’ compensation premium audit. The product combines a straightforward public website with a private, signed-in audit workspace.

## Product flow

1. Sign in and open a user-owned audit workspace.
2. Upload payroll, tax, ledger, policy, and subcontractor records.
3. Review the required-document checklist and open gaps.
4. Download a structured audit-packet index for human review.
5. Delete individual documents or all account data at any time.

## Security model

- Portal routes require an authenticated user.
- Every API read and write checks the server-provided user ID.
- Structured audit metadata is stored in Cloudflare D1.
- Uploaded files are stored without public URLs in Cloudflare R2.
- Uploads are restricted by extension, MIME type, file signature, and size.
- Object keys use random identifiers rather than customer filenames.
- Material workspace actions are recorded in an activity log.

Malware scanning, automated sensitive-data redaction, insurer-specific packet generation, and production AI extraction remain pre-launch integrations. Do not market the app as fully security-certified until an independent review and penetration test are complete.

## Technology

- Next.js 16, React 19, and TypeScript
- Vinext with Cloudflare Workers-compatible output
- Cloudflare D1 and Drizzle ORM for relational data
- Cloudflare R2 for private document storage
- Sites-provided sign-in for the protected portal

This application assists with document preparation. It does not provide legal, tax, payroll, or insurance advice. A person must review all output before insurer submission.
