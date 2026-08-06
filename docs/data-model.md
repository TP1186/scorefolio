# AuditSentry data model

The proof of concept stores its synthetic typed records in `lib/demo-data.ts`. A production implementation should persist the following entities.

## Ownership and access

### agencies

- `id`
- `name`
- `status`
- `created_at`

### users

- `id`
- `email`
- `display_name`
- `identity_provider_id`
- `created_at`

### memberships

- `id`
- `agency_id`
- `user_id`
- `role`: owner, licensed_reviewer, account_manager, read_only
- `created_at`

## Insured accounts

### clients

- `id`
- `agency_id`
- `legal_name`
- `doing_business_as`
- `industry_code`
- `state`
- `tax_id_token`
- `created_at`

### policies

- `id`
- `client_id`
- `carrier_name`
- `policy_number_token`
- `policy_type`
- `effective_date`
- `expiration_date`
- `estimated_premium_cents`
- `audit_deadline`
- `status`

### workers

- `id`
- `client_id`
- `external_worker_id`
- `display_name_token`
- `job_title`
- `classification_code`
- `classification_source`
- `active_from`
- `active_to`

### payroll_entries

- `id`
- `policy_id`
- `worker_id`
- `period_start`
- `period_end`
- `regular_wages_cents`
- `overtime_wages_cents`
- `other_remuneration_cents`
- `source_document_id`
- `source_locator_json`

## Subcontractor evidence

### subcontractors

- `id`
- `client_id`
- `legal_name`
- `tax_id_token`
- `trade`
- `status`

### subcontractor_payments

- `id`
- `policy_id`
- `subcontractor_id`
- `payment_date`
- `amount_cents`
- `description`
- `source_document_id`
- `source_locator_json`

### certificates

- `id`
- `subcontractor_id`
- `policy_id`
- `certificate_number_token`
- `named_insured`
- `coverage_type`
- `effective_date`
- `expiration_date`
- `carrier_name`
- `status`
- `source_document_id`

## Documents and AI provenance

### documents

- `id`
- `client_id`
- `policy_id`
- `r2_object_key`
- `original_filename`
- `content_type`
- `byte_size`
- `sha256`
- `category`
- `extraction_status`
- `uploaded_by_user_id`
- `created_at`

### document_extractions

- `id`
- `document_id`
- `parser_version`
- `model_version`
- `schema_version`
- `facts_json`
- `confidence_json`
- `created_at`

### findings

- `id`
- `policy_id`
- `finding_type`
- `severity`
- `title`
- `description`
- `estimated_exposure_cents`
- `rule_version`
- `model_version`
- `source_references_json`
- `status`: open, resolved, accepted_risk, dismissed
- `resolved_by_user_id`
- `resolved_at`

### tasks

- `id`
- `policy_id`
- `finding_id`
- `title`
- `owner_user_id`
- `due_at`
- `status`

### audit_packets

- `id`
- `policy_id`
- `version`
- `manifest_json`
- `r2_object_key`
- `status`: draft, reviewed, exported, submitted
- `approved_by_user_id`
- `created_at`

### audit_events

- `id`
- `agency_id`
- `client_id`
- `actor_user_id`
- `event_type`
- `object_type`
- `object_id`
- `metadata_json`
- `created_at`

## Essential indexes

- Unique membership on `(agency_id, user_id)`.
- Policies on `(client_id, status)` and `(audit_deadline, status)`.
- Documents on `(policy_id, category)` and unique `(client_id, sha256)`.
- Findings on `(policy_id, status, severity)`.
- Subcontractor payments on `(policy_id, subcontractor_id, payment_date)`.
- Certificates on `(subcontractor_id, effective_date, expiration_date)`.
- Audit events on `(client_id, created_at)`.

Indexes should be verified against actual query plans before production rollout.
