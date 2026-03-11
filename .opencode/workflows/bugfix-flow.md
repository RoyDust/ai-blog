# Bugfix Flow

Use this when you have a failing test, runtime error, broken UI behavior, or an unclear regression.

## Flow

1. `personal-using-superpowers`
2. `personal-systematic-debugging`
3. `personal-test-driven-development` when you need regression protection
4. `personal-verification-before-completion`

## Intent

This flow makes you prove the bug first, narrow the cause, and only then apply a fix. If the bug can come back, add or update a test before you finish.

## Exit Criteria

- The failure was reproduced or otherwise confirmed.
- The likely root cause was tested rather than guessed.
- The fix is validated by a targeted check.
- A regression test exists when the bug is likely to recur.
