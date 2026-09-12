# OpenCode Personal Skills Installation Design

**Date:** 2026-03-12

**Goal:** Install a compact personal-development skill stack for OpenCode both inside this repository and in the user's global OpenCode directory, with clear workflow docs for feature work, debugging, refactoring, and final verification.

## Confirmed Decisions

- The skill set includes `using-superpowers` plus five workflow skills: `brainstorming`, `writing-plans`, `test-driven-development`, `systematic-debugging`, and `verification-before-completion`.
- Delivery should happen in two places: a repository-local `.opencode/` template and the real global OpenCode skills directory.
- The repository version should be safe to commit, inspect, and reuse in future projects.
- The global version should be structured the way OpenCode discovers personal skills from `~/.config/opencode/skills/`.
- The workflow documentation should be tailored for solo development rather than teams.

## Recommended Approach

Create a repository-local OpenCode package that contains:

- `.opencode/skills/personal-*/SKILL.md` files for the six personal skills
- `.opencode/workflows/*.md` documents that explain when and how to combine those skills
- `.opencode/README.md` with installation and usage instructions
- `.opencode/global-install/skills/` as a mirrorable export for easy copying into the user's global OpenCode config

Then install the same skill set into the actual global OpenCode config at `~/.config/opencode/skills/` so OpenCode can discover the skills immediately.

## Approaches Considered

### 1. Repository-only template

This is the safest and most portable option, but it does not satisfy the request to make the skills available globally right away.

### 2. Global-only installation

This is the fastest path to immediate usage, but it loses project-level documentation, versioning, and reuse.

### 3. Dual install (recommended)

This combines the strengths of both options. The repository keeps a documented, reusable source of truth, while the global OpenCode directory gets a ready-to-use installed copy.

## Information Architecture

### Repository structure

- `.opencode/README.md`
- `.opencode/skills/personal-using-superpowers/SKILL.md`
- `.opencode/skills/personal-brainstorming/SKILL.md`
- `.opencode/skills/personal-writing-plans/SKILL.md`
- `.opencode/skills/personal-test-driven-development/SKILL.md`
- `.opencode/skills/personal-systematic-debugging/SKILL.md`
- `.opencode/skills/personal-verification-before-completion/SKILL.md`
- `.opencode/workflows/daily-default.md`
- `.opencode/workflows/feature-flow.md`
- `.opencode/workflows/bugfix-flow.md`
- `.opencode/workflows/refactor-flow.md`
- `.opencode/global-install/skills/...`

### Global structure

- `~/.config/opencode/skills/personal-using-superpowers/SKILL.md`
- `~/.config/opencode/skills/personal-brainstorming/SKILL.md`
- `~/.config/opencode/skills/personal-writing-plans/SKILL.md`
- `~/.config/opencode/skills/personal-test-driven-development/SKILL.md`
- `~/.config/opencode/skills/personal-systematic-debugging/SKILL.md`
- `~/.config/opencode/skills/personal-verification-before-completion/SKILL.md`

## Skill Design

Each personal skill should be a thin, practical wrapper around the underlying method rather than a rewritten framework. Each skill file should include:

- frontmatter with `name` and `description`
- when to use the skill
- a short checklist
- how it hands off to the next skill in the solo-dev workflow
- OpenCode-oriented wording instead of Claude-specific tool names where possible

The skill names should be prefixed with `personal-` so they do not collide with upstream superpowers skills while still reading clearly in OpenCode's skill list.

## Workflow Design

The workflow docs should standardize four solo-dev paths:

- `daily-default.md`: the shortest routine for ordinary work
- `feature-flow.md`: `using-superpowers -> brainstorming -> writing-plans -> test-driven-development -> verification-before-completion`
- `bugfix-flow.md`: `using-superpowers -> systematic-debugging -> test-driven-development` when regression coverage is needed `-> verification-before-completion`
- `refactor-flow.md`: `using-superpowers -> brainstorming -> writing-plans -> test-driven-development -> verification-before-completion`

Each workflow doc should explain the purpose of the flow, the trigger conditions, and the exit criteria.

## Installation Strategy

1. Create the repository-local `.opencode/` source files first.
2. Mirror the skill files into `.opencode/global-install/skills/` for explicit export.
3. Detect or create the user's global OpenCode config directory at `~/.config/opencode/skills/`.
4. Copy the six skill directories into the global skills location.
5. Leave existing unrelated global skills untouched.

## Safety Notes

- Do not modify unrelated existing global skills.
- Do not overwrite user-specific OpenCode plugin configuration unless needed.
- Keep file contents ASCII and markdown-only for easy maintenance.
- Avoid symlink-only installation so the setup remains readable and portable on Windows.

## Verification

Success is defined by all of the following:

- The repository contains the `.opencode/` skill and workflow files.
- The global OpenCode skills directory contains the six installed `personal-*` skills.
- The installed skill files match the repository-local versions.
- The README explains both local and global usage clearly enough for later reuse.

## Follow-on Planning

After this design document is written, the next step is to create a detailed implementation plan covering file creation, global installation, and verification steps.
