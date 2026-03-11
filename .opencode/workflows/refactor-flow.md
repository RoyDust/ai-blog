# Refactor Flow

Use this when improving structure, extracting modules, simplifying logic, or cleaning up code without intentionally changing product behavior.

## Flow

1. `personal-using-superpowers`
2. `personal-brainstorming`
3. `personal-writing-plans`
4. `personal-test-driven-development`
5. `personal-verification-before-completion`

## Intent

This flow keeps refactors disciplined. You still define scope and risks, then break the work into safe increments, then rely on tests and final verification to prove behavior stayed stable.

## Exit Criteria

- The refactor goal is narrow and explicit.
- Risky areas are called out before edits begin.
- Existing behavior is covered by tests or focused manual checks.
- Final verification confirms no accidental behavior drift.
