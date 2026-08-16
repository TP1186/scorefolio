# AuditSentry autonomous development cycle

Work inside the current AuditSentry repository. `DEVELOPMENT_TRACKER.md` is the source of truth for development priorities and completion state.

## Objective

Complete exactly one highest-priority unchecked tracker item that is safely achievable using only the current local repository and synthetic test data.

## Completed directed development step

The provider-neutral malware scanner adapter, lifecycle enforcement, quarantine behavior, and synthetic safe/unsafe/timeout/provider-error fixtures are complete. Resume the normal priority order below. Do not mark the production malware-scanning launch gate complete until a real provider has been selected, configured, and validated.

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
7. Decide whether the selected tracker task is complete. It is complete only when the implementation, automated tests, stated acceptance criteria, and relevant build all pass. Use `[~]` when implementation exists but still requires an external integration, human gate, or production validation.
8. If the selected task is incomplete or blocked, do not commit, push, or deploy it. Keep the unfinished work local so the next run can continue it, update the tracker honestly, append the exact blocker to `AUTOMATION_LOG.md`, and stop.
9. If the selected task is complete:
   - change its tracker state to `[x]`;
   - inspect the final diff and ensure it contains only files belonging to that specific task plus its tracker and automation-log updates;
   - commit those files with a task-specific message;
   - push the current branch to its configured `origin` upstream;
   - when the task changes application logic, UI, API behavior, database schema, or production assets, build and deploy the exact pushed commit through the existing private Sites project;
   - confirm the deployment succeeded and perform a safe production smoke check when available;
   - never deploy documentation-only or test-only changes that do not alter the running product.
10. Append a concise entry to `AUTOMATION_LOG.md` containing:
   - UTC date and time
   - selected tracker item
   - outcome
   - files changed
   - validation performed
   - commit SHA and push result when completed
   - deployment version, result, and URL when deployment was required
   - blocker or recommended next item
11. End with a concise summary. Stop after one tracker item.

## Safety and scope limits

- Commit and push only after the selected tracker task is fully complete and validated. Never ship partial, failing, speculative, or blocked work.
- Deploy only completed changes that affect the running product, and deploy the exact pushed commit. Preserve the Sites project's existing private access policy.
- Do not modify Git remotes, create branches speculatively, force-push, rewrite history, or change site access.
- Do not change the native Codex automation configuration or automation runner except to pause this task after the entire tracker is complete.
- External writes are limited to pushing the completed task to the existing Git remote and deploying that exact commit to the existing private Sites project. Do not purchase services, create external accounts, send messages, or change other external data.
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
