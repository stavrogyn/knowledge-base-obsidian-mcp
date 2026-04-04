---
name: kb-maintain
description: >-
  Maintain KB health: run lint checks, fix broken links, reindex, update index
  files. Use when the user asks to check KB health, lint the KB, clean up, find
  broken links, update indexes, or reindex.
---

# KB Maintenance and Health Checks

## When to Use

- User asks to check KB health or run lint
- User reports stale search results
- After bulk additions or edits to the vault
- User asks to clean up, find broken links, or update indexes

## Procedure

### Step 1: Run Health Check

```
Call kb_lint (no parameters needed)
```

### Step 2: Present Results

Group issues by severity and type:

```
"KB Health Report:

**Critical (N issues):**
- [issues that break functionality: broken links, missing IDs]

**Warnings (N issues):**
- [issues that degrade quality: orphan notes, missing aliases]

**Info (N issues):**
- [minor improvements: stale notes, missing optional fields]

Total: X issues found across Y notes."
```

If no issues found, report that the KB is healthy.

### Step 3: Propose Fixes

For each fixable issue category, propose a batch fix:

```
Use AskQuestion:
  prompt: "Which issues should I fix?"
  allow_multiple: true
  options:
    - id: broken-links
      label: "Fix N broken wikilinks (remove or update)"
    - id: missing-frontmatter
      label: "Add missing frontmatter fields to N notes"
    - id: orphans
      label: "Review N orphan notes (no incoming links)"
    - id: skip
      label: "Skip all — just show the report"
```

### Step 4: Apply Fixes

For each approved fix category:

1. Show what will change (note path + specific change)
2. Apply the fix using the appropriate write tool
3. Report success/failure for each change

Fixes are limited to writable directories (`01-wiki/`, `05-agent-memory/`, `06-sessions/`, `07-indexes/`). Issues in human-authored directories (`02-projects/`, `03-people/`, `04-decisions/`) are reported but not auto-fixed — suggest manual action to the user.

### Step 5: Reindex

After applying fixes:

```
Call kb_reindex
```

Report the reindex stats (total notes, added, updated, errors).

### Step 6: Update Indexes

Offer to refresh the LLM-maintained index files:

```
Use AskQuestion:
  prompt: "Should I update the index files in 07-indexes/?"
  options:
    - id: yes
      label: "Yes — update master index, concepts, projects, recent changes"
    - id: selective
      label: "Let me pick which indexes to update"
    - id: no
      label: "No — indexes are fine"
```

If yes: read current index files, regenerate with current vault state, call `kb_update_index` for each.

## Proactive Maintenance

When working on other KB tasks, if you notice issues (broken link, missing alias, orphan note), mention them briefly:

"Note: I noticed [issue]. Want me to fix it while we're here?"

Do not fix proactively without asking.

## Important

- NEVER delete notes, even orphans — only report them
- NEVER modify `source_type: human` notes — report issues for manual fix
- Always reindex after making changes
- Show the user what will change before applying any fix
