# AuditSentry autonomous development cycle

Work inside the current AuditSentry repository. `DEVELOPMENT_TRACKER.md` is the source of truth for development priorities and completion state.

## Objective

Complete exactly one highest-priority unchecked tracker item that is safely achievable using only the current local repository and synthetic test data.

## Required workflow

1. Read `DEVELOPMENT_TRACKER.md`, `README.md`, the relevant source files, and the current Git status.
2. Preserve all existing user changes. If an uncommitted change overlaps the item you would select, skip that item.
3. Select exactly one actionable unchecked item, preferring in this order:
   - Priority 0 items
   - the current critical-path milestone
   - security and data-quality foundations
   - test fixtures and automated verification
   - Priority 1 items
4. State the selected item in your internal working plan, then implement it completely.
5. Add or update automated tests appropriate to the change.
6. Run focused validation, then the broader relevant test/build commands when practical.
7. Change `[ ]` to `[x]` in `DEVELOPMENT_TRACKER.md` only if the tracker item and its stated acceptance criteria are genuinely satisfied. Use `[~]` when implementation exists but still requires an external integration or production validation.
8. Append a concise entry to `AUTOMATION_LOG.md` containing:
   - UTC date and time
   - selected tracker item
   - outcome
   - files changed
   - validation performed
   - blocker or recommended next item
9. End with a concise summary. Stop after one tracker item.

## Safety and scope limits

- Do not commit, push, publish, deploy, release, or modify Git remotes.
- Do not change the Windows scheduled task or automation runner.
- Do not purchase services, create external accounts, send messages, or change external data.
- Do not use real customer, payroll, employee, policy, or tax data. Create only clearly synthetic fixtures.
- Do not add secrets, request credentials, expose authentication material, or weaken security controls.
- Do not claim legal, tax, payroll, actuarial, or insurance conclusions.
- Do not complete items that require an unresolved product decision, paid provider, legal review, licensed professional, external credential, custom domain, or production access.
- Do not mark broad milestones complete after implementing only a partial slice.
- Do not delete user files or unrelated code. Temporary files created during the run may be removed when their exact paths are known.
- Do not use destructive Git commands.
- Do not perform major dependency upgrades unless the selected item cannot be implemented safely without one and the upgrade passes all relevant checks.
- Keep the change reviewable. If the selected item is too large for one bounded cycle, implement and track one independently useful vertical slice without falsely completing the parent item.

If no unchecked item can be completed safely under these limits, make no speculative product changes. Append the specific blocker to `AUTOMATION_LOG.md` and stop.
