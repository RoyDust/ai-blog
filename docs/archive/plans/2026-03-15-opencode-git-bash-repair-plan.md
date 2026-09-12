# OpenCode Git Bash Repair Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task-by-task.

**Goal:** Repair the broken Git Bash/MSYS installation on Windows so OpenCode can run shell commands like `pwd` and `git status` again.

**Architecture:** Treat this as a system toolchain repair, not a repository bug. Avoid deleting files under `C:\Program Files\Git` by hand unless a clean uninstall/reinstall leaves known-bad leftovers behind. Prefer capturing evidence and backing up user-level Git config first, then performing a clean reinstall of Git for Windows, then verifying both Git Bash and OpenCode behavior.

**Tech Stack:** Windows 11, PowerShell, Git for Windows, Git Bash/MSYS2 runtime, OpenCode CLI

---

### Task 1: Capture baseline evidence and preserve user config

**Files:**
- Create: `docs/plans/2026-03-15-opencode-git-bash-repair-plan.md`
- Inspect: `C:\Program Files\Git\bin\bash.exe`
- Inspect: `C:\Program Files\Git\usr`
- Backup: `C:\Users\Administrator\.gitconfig`

**Step 1: Reproduce the failure one more time**

Run:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' --version
```

Expected:

```text
Top-level not found: C:\Program Files\Git\usr\usr\usr\bin
```

**Step 2: Confirm the broken nested MSYS layout exists**

Run:

```powershell
Get-ChildItem 'C:\Program Files\Git\usr' -Directory -Recurse -Depth 4 |
  Where-Object { $_.FullName -match '\\usr(\\usr)+' } |
  Select-Object FullName
```

Expected: entries such as `C:\Program Files\Git\usr\usr` and `C:\Program Files\Git\usr\usr\usr`.

**Step 3: Back up user-level Git config**

Run:

```powershell
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
if (Test-Path "$env:USERPROFILE\.gitconfig") {
  Copy-Item "$env:USERPROFILE\.gitconfig" "$env:USERPROFILE\.gitconfig.backup-$stamp"
}
```

Expected: a backup file appears next to `C:\Users\Administrator\.gitconfig`.

**Step 4: Record current Git resolution**

Run:

```powershell
where.exe git
git --version
git --exec-path
```

Expected: `git.exe` still works from `C:\Program Files\Git\cmd\git.exe`, while `bash.exe` remains broken.

**Step 5: Stop before changing anything**

Checkpoint:

- If `git.exe` is also broken, pause and widen scope before uninstalling.
- If only `bash.exe` is broken, continue with Task 2.

### Task 2: Perform the safest remediation path

**Files:**
- Inspect: `C:\Program Files\Git`
- Preserve if needed: `C:\Program Files\Git-broken-*`
- Reinstall target: `C:\Program Files\Git`

**Step 1: Close processes that may hold Git files open**

Close:

- OpenCode
- Cursor / VS Code terminals using Git Bash
- Standalone Git Bash windows
- Tools that embed Git Bash shells

Expected: no active shell is still using `C:\Program Files\Git`.

**Step 2: Uninstall Git for Windows through the normal Windows path**

Preferred:

1. Open `Settings -> Apps -> Installed apps`
2. Find `Git`
3. Choose `Uninstall`

Alternative:

```powershell
winget uninstall --id Git.Git
```

Expected: Windows removes the registered Git installation cleanly.

**Step 3: Check whether `C:\Program Files\Git` still exists**

Run:

```powershell
Test-Path 'C:\Program Files\Git'
```

Expected: `False`.

**Step 4: If leftovers remain, quarantine them instead of deleting them**

Run only if `C:\Program Files\Git` still exists:

```powershell
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
Rename-Item 'C:\Program Files\Git' "Git-broken-$stamp"
```

Expected: the old broken tree is renamed, not deleted.

**Step 5: Reinstall Git for Windows fresh**

Install the current stable Git for Windows release using the official installer.

Recommended installer choices:

- PATH option: `Git from the command line and also from 3rd-party software`
- SSH option: keep your current preference
- Terminal emulator: default is fine
- Keep the install root as `C:\Program Files\Git`

Expected: a fresh `C:\Program Files\Git` is created without nested `usr\usr\...` directories.

### Task 3: Verify Git Bash before testing OpenCode

**Files:**
- Verify: `C:\Program Files\Git\bin\bash.exe`
- Verify: `C:\Program Files\Git\usr`

**Step 1: Check that Git Bash itself launches**

Run:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' --version
```

Expected: a normal Bash version string, not `Top-level not found`.

**Step 2: Check the nested bad directories are gone**

Run:

```powershell
Get-ChildItem 'C:\Program Files\Git\usr' -Directory -Recurse -Depth 4 |
  Where-Object { $_.FullName -match '\\usr(\\usr)+' } |
  Select-Object FullName
```

Expected: no output.

**Step 3: Verify Bash can execute in the repository**

Run:

```powershell
& 'C:\Program Files\Git\bin\bash.exe' -lc 'pwd'
& 'C:\Program Files\Git\bin\bash.exe' -lc 'git status --short --branch'
```

Expected:

- `pwd` prints a valid path
- `git status --short --branch` prints repository status

**Step 4: Verify native Git still resolves correctly**

Run:

```powershell
where.exe git
git --version
git status --short --branch
```

Expected: all commands succeed from PowerShell too.

### Task 4: Verify the original OpenCode symptom is resolved

**Files:**
- Verify: OpenCode global install
- Verify: repository working directory

**Step 1: Re-run lightweight OpenCode diagnostics**

Run:

```powershell
opencode --version
opencode debug paths
```

Expected: both commands succeed.

**Step 2: Re-test the exact behavior that failed before**

Inside OpenCode, retry:

- `pwd`
- `git status --short --branch`

Expected: both commands now execute instead of returning the `Top-level not found` error.

**Step 3: If OpenCode still fails but Git Bash now works, stop and inspect OpenCode shell configuration**

Check:

- `C:\Users\Administrator\.config\opencode\opencode.json`
- `C:\Users\Administrator\.config\opencode\config.json`
- `F:\Code\NewProject\my-next-app\.opencode\opencode.json`
- `F:\Code\NewProject\my-next-app\.opencode\opencode.jsonc`

Expected: most likely no shell override is needed once Git Bash is healthy.

### Task 5: Rollback and escalation rules

**Files:**
- Preserve: `C:\Program Files\Git-broken-*`
- Preserve: `C:\Users\Administrator\.gitconfig.backup-*`

**Step 1: Do not manually delete `C:\Program Files\Git\usr\usr\...` first**

Reason: this is the riskiest path and gives the least confidence that the install is truly healthy afterward.

**Step 2: If reinstall succeeds but nested `usr\usr` paths reappear**

Treat that as a second root cause. Possible follow-up suspects:

- a broken post-install script
- a third-party sync/restore tool
- antivirus or endpoint protection tampering
- a tool that copied `bash.exe` into `usr\usr\...`

**Step 3: If needed, rollback by restoring only user config**

Run:

```powershell
Copy-Item "$env:USERPROFILE\.gitconfig.backup-<timestamp>" "$env:USERPROFILE\.gitconfig" -Force
```

Expected: user aliases, name/email, and local preferences are restored.

**Step 4: Keep the quarantined broken tree for one day before deleting it**

Reason: it preserves forensic evidence if the corruption returns.
