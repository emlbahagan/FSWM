# FSWM Agent Instructions

Follow these rules for every change in this repository.

## Project Sources

- Use `docs/codex_build_checklist.md` as the controlling build guide.
- Preserve Patch A requirements from `database/patches/fswm_patch_a_database_hotfixes.md`.
- Preserve Patch B requirements from `database/patches/fswm_patch_b_use_case_alignment.md`.
- Check `docs/actor_permissions.md`, `docs/workflow_rules.md`, `docs/status_transition_matrix.md`, `docs/validation_codes.md`, and `docs/security_privacy_plan.md` before implementing protected workflows.

## Build Rules

- Inspect existing files before editing.
- Keep changes small and phase-scoped.
- Use SQL-first database migrations.
- Do not use Prisma as the schema owner.
- Do not invent tables without checking the schema blueprint first.
- Put all database changes under `database/migrations/`.
- Require server-side authorization for every protected action.
- Hide unauthorized UI, but do not rely on UI hiding for security.
- Write audit logs for workflow decisions.
- Write revision history for schedule-changing actions.
- Never create student accounts or student-facing modules in the current scope.

## Safety Rules

- Never commit `.env`, `.env.local`, database passwords, API keys, access tokens, service-role keys, or database dumps.
- Do not expose secrets through `NEXT_PUBLIC_*`.
- Do not overwrite unrelated user changes.

## Validation

After edits, run the applicable commands:

```cmd
git status
git diff
npm run lint
npm run test
npm run build
```

If tests are not configured yet, run:

```cmd
npm run lint
npm run build
```

