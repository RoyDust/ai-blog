---
name: personal-test-driven-development
description: Use during implementation to protect behavior with focused failing tests, minimal code, and frequent verification.
---

# Personal Test-Driven Development

## Purpose

Use this during implementation when logic, data flow, or regressions matter. The goal is to keep changes honest by proving behavior with tests instead of confidence.

## Use When

- Adding business logic
- Fixing a bug that could return later
- Refactoring risky code paths
- Changing APIs, hooks, or stateful behavior

## Checklist

1. Write or update a focused failing test when practical.
2. Run the test to confirm the failure.
3. Add the smallest code change that makes it pass.
4. Re-run targeted tests.
5. Continue in small increments.

## Handoff

When the implementation is done, load `personal-verification-before-completion` and prove the whole change works.
