# OpenCode Quick Start

Use this file as the fast path for daily solo development.

## Installed Skills

- `personal-using-superpowers`
- `personal-brainstorming`
- `personal-writing-plans`
- `personal-test-driven-development`
- `personal-systematic-debugging`
- `personal-verification-before-completion`

## Default Routine

1. Load `personal-using-superpowers`.
2. Choose the matching workflow.
3. Finish with `personal-verification-before-completion`.

## Fixed Flows

### New Feature

`personal-using-superpowers` -> `personal-brainstorming` -> `personal-writing-plans` -> `personal-test-driven-development` -> `personal-verification-before-completion`

### Bug Fix

`personal-using-superpowers` -> `personal-systematic-debugging` -> `personal-test-driven-development` when regression coverage matters -> `personal-verification-before-completion`

### Refactor

`personal-using-superpowers` -> `personal-brainstorming` -> `personal-writing-plans` -> `personal-test-driven-development` -> `personal-verification-before-completion`

## When To Use Which Skill

- `personal-using-superpowers`: first step for every task
- `personal-brainstorming`: before changing behavior, UX, or architecture
- `personal-writing-plans`: when the work is bigger than a tiny edit
- `personal-test-driven-development`: when logic, regressions, or risky changes matter
- `personal-systematic-debugging`: when something is broken and the cause is unclear
- `personal-verification-before-completion`: before you say the work is done

## Prompt Templates

### Start Any Task

```text
Load personal-using-superpowers and tell me which workflow I should use for this task: <task>
```

### Start Feature Work

```text
Load personal-brainstorming and help me define the scope, trade-offs, and recommended approach for: <feature>
```

### Turn Design Into Steps

```text
Load personal-writing-plans and break this approved direction into small implementation steps: <approved design>
```

### Debug A Problem

```text
Load personal-systematic-debugging and help me reproduce, narrow, and verify this issue: <bug>
```

### Verify Before Finish

```text
Load personal-verification-before-completion and tell me which checks I should run before I call this done: <change>
```

## Fastest Safe Shortcut

If you only remember one rule, remember this:

`personal-using-superpowers` first, `personal-verification-before-completion` last.
