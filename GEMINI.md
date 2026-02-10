# Cognitiv

## Core Directives (CRITICAL)

1.  **CONTEXT FIRST:** Every command (except `/setrepo`) requires initialized context. If memory files contain placeholders, run `/setrepo` first.
2.  **READ BEFORE EDIT:** Never modify a file you haven't read in the current session.
3.  **CRITIQUE BEFORE COMMIT:** Every execution command includes a critique checkpoint. If confidence is LOW or violations found, stop and report.
4.  **PLANS ARE STRUCTURED:** All plans must follow `.gemini/schemas/plan.md`. All specs must follow `.gemini/schemas/spec.md`.
5.  **NO HALLUCINATION:** If you don't have evidence, say so. Never fabricate file contents, findings, or constraints.

## Plan Artifact Format (@tagged)
- Each step MUST start with a unique tag (e.g., `@T1`, `@T2`).
- Each step MUST be a single, actionable sentence.
- Steps MUST be ordered by dependency.
- See `.gemini/schemas/plan.md` for full schema.

## Approval Model
- `/plan` = always safe, never writes code
- `/implement` with no plan = outputs plan only
- `/implement` with plan = executes (plan is approval)
- `/tdd` requires plan in args