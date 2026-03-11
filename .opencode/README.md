# OpenCode Personal Skills

This directory packages a solo-development skill stack for OpenCode.

## Included Skills

- `personal-using-superpowers`
- `personal-brainstorming`
- `personal-writing-plans`
- `personal-test-driven-development`
- `personal-systematic-debugging`
- `personal-verification-before-completion`

## Included Workflows

- `workflows/daily-default.md`
- `workflows/feature-flow.md`
- `workflows/bugfix-flow.md`
- `workflows/refactor-flow.md`

## Quick Start

- Start with `.opencode/QUICKSTART.md` for the fastest way to use the installed personal skills in OpenCode.

## Repository Usage

Project-local skills live in `.opencode/skills/`. OpenCode should prefer these over global skills when you are inside this repository.

Suggested starting points:

- New feature: load `personal-using-superpowers`, then follow `workflows/feature-flow.md`
- Bug fix: load `personal-using-superpowers`, then follow `workflows/bugfix-flow.md`
- Refactor: load `personal-using-superpowers`, then follow `workflows/refactor-flow.md`

## Global Installation

The mirrorable export lives in `.opencode/global-install/skills/`.

OpenCode personal skills are installed globally under:

- `C:/Users/Administrator/.config/opencode/skills/`

If you want to refresh the global copies from this repository later, copy the `personal-*` directories from `.opencode/global-install/skills/` into that global skills directory.
