---
name: personal-systematic-debugging
description: Use when behavior is broken or unclear to reproduce the issue, narrow the cause, and validate the fix before changing too much.
---

# Personal Systematic Debugging

## Purpose

Use this when something is failing and you do not want to thrash. The skill keeps you from guessing by forcing you to confirm the symptom and test hypotheses one by one.

## Use When

- A test fails unexpectedly
- The UI behaves incorrectly
- An API or integration breaks
- You do not know the root cause yet

## Checklist

1. Reproduce the bug or confirm the failure signal.
2. Write down the exact symptom.
3. Narrow the search area before editing.
4. Test one root-cause hypothesis at a time.
5. Only apply a fix after evidence points to the cause.
6. Add regression coverage with `personal-test-driven-development` when needed.

## Handoff

If the fix needs protection, switch to `personal-test-driven-development`. Always finish with `personal-verification-before-completion`.
