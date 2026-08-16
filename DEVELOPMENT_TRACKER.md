# AuditSentry Development Tracker

Last updated: August 16, 2026
Current stage: Secure product foundation / pre-beta  
Target offer: $79 founding-customer beta, then $129 per completed audit

## Product objective

AuditSentry helps a small business prepare a workers’ compensation premium-audit package. A customer uploads payroll, tax, ledger, policy, and subcontractor records; AuditSentry identifies missing or inconsistent evidence; the customer reviews the results and downloads one organized submission packet.

The product is ready to sell when it can reliably turn a supported set of real customer documents into a traceable, review-ready packet—not merely store files or display a checklist.

## Status legend

- `[x]` Complete and verified
- `[~]` Implemented but requires production validation or expansion
- `[ ]` Not started
- `[!]` Blocking the next release

## Current product status

### Marketing and experience

- [x] Customer-focused AuditSentry landing page
- [x] Clear three-step product explanation
- [x] Security and privacy positioning
- [x] Initial $129 per-audit offer
- [x] Responsive desktop and mobile layouts
- [x] Branded social-preview image and metadata
- [ ] Replace temporary preview URL with a customer-facing domain
- [ ] Add privacy policy, terms of service, and acceptable-use policy
- [ ] Add support and sales contact workflow
- [ ] Add product analytics and conversion events

### Accounts and workspaces

- [x] Sign-in-gated portal
- [x] Stable user ownership derived from authenticated server headers
- [x] User-owned audit workspace
- [x] Workspace profile editing
- [x] Account activity log
- [x] Individual-document deletion
- [x] Full account-data deletion
- [ ] Public customer authentication suitable for a custom domain
- [ ] Passwordless email login and MFA options
- [ ] Session, device, and recent-login management
- [ ] Owner and Collaborator workspace roles
- [ ] Account recovery and support-assisted identity workflow

### Data and document storage

- [x] D1 relational schema for audits, documents, and activity
- [x] R2 private object storage for uploaded files
- [x] Random object keys that do not expose customer filenames
- [x] Server-side ownership checks on workspace actions
- [x] File-extension and MIME-type allowlists
- [x] Basic file-signature validation
- [x] 10 MB upload limit
- [x] Upload rollback if the database write fails
- [ ] Direct private download with short-lived signed access
- [ ] Multi-file and drag-and-drop uploads
- [ ] Resumable uploads for larger reports
- [ ] Configurable 30/60/90-day retention policy
- [ ] Automated deletion after the selected retention period
- [ ] Encrypted backup and recovery procedure

### Audit workflow

- [x] Required-document checklist
- [x] Filename-based document categorization
- [x] Completeness-based readiness score
- [x] Missing-document gap list
- [x] Structured JSON packet index
- [ ] Audit-request intake wizard
- [ ] Policy period, carrier, policy number, and due-date capture
- [ ] Business type, state, employee count, and subcontractor intake
- [ ] Carrier-specific document-request checklist
- [ ] Human resolution and approval states
- [ ] Finding comments, notes, and dismissal reasons
- [ ] Final submission confirmation and audit closure

## Critical path to paid beta

### Milestone 1 — Document processing foundation `[!]`

Objective: Turn uploaded documents into normalized, traceable records.

- [x] Create background processing queue and document-status lifecycle
- [ ] Add malware scanning before any document is processed
- [ ] Detect password-protected, corrupt, and unsupported files
- [ ] Extract text from native PDFs
- [ ] Add OCR for scanned PDFs and images
- [ ] Parse CSV and Excel workbooks without flattening important structure
- [ ] Store extracted text separately from original files
- [ ] Store page, sheet, row, and cell references for every extracted value
- [ ] Detect and redact Social Security numbers before AI processing
- [ ] Add extraction confidence for each field
- [ ] Create manual correction UI for low-confidence fields
- [ ] Ensure failed processing never produces a verified result

Acceptance criteria:

- A supported document receives `uploaded`, `scanning`, `extracting`, and `ready` or `needs_review` states.
- Every extracted figure links back to its source page, sheet, row, or cell.
- Unsupported or unsafe documents are quarantined and explained to the customer.
- No complete Social Security number is sent to an AI provider.

### Milestone 2 — First supported audit set `[!]`

Objective: Support a deliberately narrow document set well enough to charge for it.

Initial supported documents:

- [ ] Payroll summary or payroll register
- [ ] Federal Form 941 for all four quarters
- [ ] General ledger exported as CSV or XLSX
- [ ] Workers’ compensation policy declarations
- [ ] Carrier audit-request letter
- [ ] Subcontractor certificate-of-insurance PDFs

Normalized data model:

- [ ] Policy period and policy identifiers
- [ ] Employee name or privacy-safe employee identifier
- [ ] Gross wages by employee and policy period
- [ ] Overtime and other deductible wage components
- [ ] Job title and reported classification
- [ ] Quarterly taxable wages
- [ ] General-ledger labor and subcontractor totals
- [ ] Subcontractor name, payment total, and work dates
- [ ] Certificate effective and expiration dates
- [ ] Certificate holder and insured business names

Acceptance criteria:

- Each required document is automatically classified correctly on the supported test set.
- Customers can review and correct every normalized field.
- The application distinguishes missing data from extraction failure.

### Milestone 3 — Reconciliation and findings `[!]`

Objective: Produce findings that save time or reveal a financially meaningful discrepancy.

- [ ] Reconcile payroll-register totals to quarterly Form 941 totals
- [ ] Reconcile payroll totals to general-ledger labor accounts
- [ ] Flag policy-period transactions outside the covered dates
- [ ] Identify subcontractor payments without a matching certificate
- [ ] Identify certificate coverage gaps during paid work dates
- [ ] Identify likely business-name mismatches across certificates and ledgers
- [ ] Flag duplicate documents and duplicate transactions
- [ ] Separate deterministic rules from AI-generated explanations
- [ ] Assign severity, confidence, financial relevance, and recommended action
- [ ] Link every finding to its source evidence
- [ ] Add customer resolution, correction, and dismissal workflows
- [ ] Prevent AI from presenting legal, tax, or insurance conclusions as facts

Acceptance criteria:

- Deterministic calculations reproduce the same result for the same inputs.
- Every material finding displays the formula, source values, and source locations.
- Low-confidence findings require customer confirmation.
- A completed test audit includes no unsupported or invented amounts.

### Milestone 4 — Professional audit packet `[!]`

Objective: Deliver the paid outcome in a format a customer can review and submit.

- [ ] Generate a branded PDF cover and packet index
- [ ] Include company, carrier, policy, and audit-period information
- [ ] Include document-completeness summary
- [ ] Include resolved and unresolved finding summary
- [ ] Generate organized filenames for original evidence
- [ ] Build downloadable ZIP containing the index and approved source documents
- [ ] Add packet preview before purchase and download
- [ ] Add a customer attestation that all information was reviewed
- [ ] Record packet generation and download in the activity log
- [ ] Automatically schedule original files for deletion after export

Acceptance criteria:

- A customer can download one readable PDF and one organized ZIP.
- The packet never includes a document the customer excluded.
- The packet clearly identifies unresolved gaps and AI-assisted content.
- Regenerating a packet produces a new immutable export record.

### Milestone 5 — Payment and fulfillment `[!]`

Objective: Convert a completed preview into a paid audit packet.

- [ ] Add Stripe-hosted Checkout
- [ ] Create a $79 founding-customer beta price
- [ ] Create a $129 standard per-audit price
- [ ] Store payment status without storing payment-card data
- [ ] Verify Stripe webhook signatures
- [ ] Unlock export only after verified payment
- [ ] Generate receipts and customer confirmation emails
- [ ] Add refund and failed-payment workflows
- [ ] Add internal transaction and support lookup

Acceptance criteria:

- A test-mode purchase unlocks exactly one audit export.
- Replayed or forged webhooks do not unlock a packet.
- Failed and refunded purchases have explicit portal states.

## Security and privacy launch gate `[!]`

The product must not accept real payroll or tax records publicly until every required item below is complete.

- [x] Production dependency audit reports no known production vulnerabilities
- [x] Authentication required for portal routes
- [x] Server-side ownership verification
- [x] Private object storage
- [x] File-type and file-size restrictions
- [x] Customer-controlled deletion
- [ ] Malware scanning and quarantine
- [ ] Automated PII detection and redaction
- [ ] AI-provider zero-training and retention configuration documented
- [ ] Secrets and encryption-key rotation procedure
- [ ] Rate limiting for authentication, upload, export, and deletion endpoints
- [ ] CSRF and replay protection reviewed for all mutations
- [ ] Security event monitoring and alerts
- [ ] Backup restoration test
- [ ] Data-retention automation test
- [ ] Incident-response plan
- [ ] Privacy policy and data-processing terms reviewed
- [ ] Independent security review and penetration test

## AI and data quality requirements

- [ ] Use structured schemas for all AI extraction responses
- [ ] Validate AI output types, ranges, dates, and totals before storage
- [ ] Never overwrite source data with AI-generated data
- [ ] Store model, prompt version, processing time, and confidence metadata
- [ ] Maintain a golden test set of sanitized audit documents
- [ ] Add extraction accuracy measurements by document type
- [ ] Add reconciliation precision and recall measurements
- [ ] Add prompt-injection defenses for document content
- [ ] Add retry and fallback behavior without duplicating charges or records
- [ ] Require human confirmation for materially consequential findings

Initial quality targets:

- Document classification accuracy: at least 95% on the supported test set
- Critical numeric-field accuracy: at least 99% after customer confirmation
- Source-link coverage: 100% for material findings
- Unsupported-value fabrication: 0 tolerated
- Deterministic reconciliation repeatability: 100%

## Test-data plan

- [ ] Create sanitized payroll-register fixtures
- [ ] Create four-quarter Form 941 fixtures
- [ ] Create general-ledger CSV and XLSX fixtures
- [ ] Create policy-declaration fixtures
- [ ] Create subcontractor certificate fixtures
- [ ] Create scanned, rotated, low-resolution, and corrupted variants
- [ ] Create known-mismatch cases with expected results
- [ ] Create clean cases that should produce no material findings
- [ ] Create malicious filenames, MIME mismatches, and oversized upload cases
- [ ] Document expected extraction and reconciliation results

Do not use unredacted customer records for development or automated testing.

## Beta-release plan

### Internal alpha

- [ ] Complete Milestones 1–3
- [ ] Process at least 20 sanitized test audits
- [ ] Resolve all critical data-integrity defects
- [ ] Confirm source links for every finding
- [ ] Validate deletion across D1, R2, exports, and backups

### Private beta

- [ ] Complete Milestones 4–5
- [ ] Recruit 5–10 businesses through bookkeepers, payroll providers, or insurance agents
- [ ] Offer founding price of $79 per audit
- [ ] Manually review every beta result before release to the customer
- [ ] Measure upload completion, time saved, findings accepted, and support burden
- [ ] Collect permission for anonymized testimonials and case studies

### Public launch

- [ ] Pass the security and privacy launch gate
- [ ] Achieve quality targets on the golden test set
- [ ] Publish customer domain, legal policies, and support contacts
- [ ] Move standard price to $129 per audit
- [ ] Add self-service refunds and account support
- [ ] Publish at least two evidence-based case studies

## Product metrics

Track the following from the first beta customer:

- Visitor-to-checklist conversion
- Checklist-to-account conversion
- Account-to-first-upload conversion
- Percentage completing all required document categories
- Median time from sign-up to packet preview
- Preview-to-paid conversion
- Average processing cost per audit
- Gross margin per paid audit
- Findings confirmed, corrected, and dismissed
- Average support minutes per audit
- Refund rate
- Packet regeneration rate
- Customer-reported hours saved
- Customer-reported premium discrepancy identified
- Referral rate from bookkeepers, agents, and payroll providers

## Known product boundaries

- AuditSentry is a preparation and evidence-organization product.
- It does not submit an audit directly to an insurer in the initial release.
- It does not provide legal, tax, payroll, actuarial, or insurance advice.
- It does not guarantee acceptance, premium reduction, or audit accuracy.
- It does not make final employee-classification decisions.
- State-specific and carrier-specific rules remain outside the first supported scope unless explicitly tested.

## Near-term backlog

### Priority 0 — Must have

- [~] Background document processing - durable queue and lifecycle complete; scanning and extraction providers remain
- [ ] Malware scanning
- [ ] OCR and spreadsheet parsing
- [ ] PII redaction
- [ ] Source-linked structured extraction
- [ ] Payroll/941/ledger reconciliation
- [ ] Certificate coverage checks
- [ ] PDF and ZIP packet export
- [ ] Stripe payment verification

### Priority 1 — Improves conversion or trust

- [ ] Guided audit-intake wizard
- [ ] Multi-file upload
- [ ] Email progress notifications
- [ ] Editable extracted values
- [ ] Carrier-specific checklist templates
- [ ] Human-reviewed service tier
- [ ] Customer support inbox
- [ ] Custom domain and public authentication

### Priority 2 — Scale after product validation

- [ ] QuickBooks Online integration
- [ ] Gusto and ADP payroll integrations
- [ ] Broker and bookkeeper multi-client accounts
- [ ] Collaborator invitations
- [ ] White-label partner packets
- [ ] Annual audit reminders
- [ ] Prior-year comparison
- [ ] General-liability premium-audit support

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-06 | Replace the enterprise broker dashboard with a customer-facing portal | Simpler product to build, explain, purchase, and market |
| 2026-08-06 | Require authentication before any document upload | Payroll, tax, and employee records are sensitive |
| 2026-08-06 | Use D1 for metadata and R2 for file objects | Keeps relational ownership checks separate from private document bytes |
| 2026-08-06 | Start with per-audit pricing rather than a subscription | The core customer need is annual and transactional |
| 2026-08-06 | Use $79 beta and $129 standard pricing | Reduces early-adopter risk while preserving value-based positioning |
| 2026-08-06 | Keep AI output subordinate to deterministic calculations and human review | Financially consequential findings must be reproducible and traceable |

## Open decisions

- [ ] Choose the customer-facing domain
- [ ] Choose the production authentication provider
- [ ] Choose the OCR/document-intelligence provider
- [ ] Choose the AI model and data-retention configuration
- [ ] Choose the malware-scanning provider
- [ ] Confirm whether a licensed insurance professional will review the paid premium tier
- [ ] Define the exact first-state and first-carrier support boundaries
- [ ] Decide whether packet payment occurs before or after preview

## Release checklist

Before every production release:

- [ ] Confirm the intended source changes
- [ ] Run lint, automated tests, and the production build
- [ ] Run the production-dependency security audit
- [ ] Apply and inspect any database migration
- [ ] Test authentication and ownership boundaries
- [ ] Test upload rejection and successful upload
- [ ] Test document and account deletion
- [ ] Test packet generation and payment entitlement
- [ ] Verify privacy, security, and AI disclaimers
- [ ] Deploy privately first and confirm health
- [ ] Record release notes and known limitations

## Next development action

Build Milestone 1 as a vertical slice using one native payroll PDF and one Form 941 PDF:

1. Upload and malware-scan both documents.
2. Extract text and structured wage totals.
3. Display each extracted total with its source page.
4. Allow the customer to correct a value.
5. Store the approved normalized value.
6. Reconcile the payroll total against the Form 941 total.
7. Generate one source-linked finding when the totals differ.

Completing this slice proves the essential AuditSentry outcome before additional document types or integrations are added.
