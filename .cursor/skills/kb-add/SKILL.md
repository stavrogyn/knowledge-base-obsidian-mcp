---
name: kb-add
description: >-
  Add knowledge to the KB with user validation. Use when the user wants to save,
  store, remember, or add information to the knowledge base, says "add to KB",
  "save this", "remember this", "store this knowledge", or provides raw content
  to ingest into the wiki.
---

# Add Knowledge to the KB

## When to Use

- User provides content and wants it stored in the KB
- User says "add this to KB", "remember this", "save this fact"
- User has raw material (article, notes, transcript) to compile into a wiki article
- User discovered something during the session worth persisting

## Procedure

### Step 1: Determine the Mode

Ask the user how they want the content added:

```
Use AskQuestion:
  prompt: "How should I add this to the KB?"
  options:
    - id: direct
      label: "Store as-is (I'll provide the final content)"
    - id: assisted
      label: "Help me structure and edit it (AI-assisted)"
```

If the user's intent is already clear from context (e.g. "just save this verbatim"), skip the question and proceed with the appropriate flow.

### Step 2: Determine the Target

```
Use AskQuestion:
  prompt: "Where in the KB should this go?"
  options:
    - id: wiki
      label: "Wiki article (01-wiki/) — compiled knowledge"
    - id: memory
      label: "Memory candidate (05-agent-memory/) — a durable fact"
    - id: session
      label: "Session summary (06-sessions/) — session context"
```

---

## Flow A: Direct (no AI editing)

For when the user provides final content and wants it stored without AI modification.

1. Take the user's content verbatim
2. Generate appropriate frontmatter based on the target:
   - `id`: slugified from title or fact
   - `type`: `wiki-article` / `memory-fact` / `session`
   - `source_type`: `human` (user provided final content)
   - `review_status`: `reviewed` (user approved before write)
   - `visibility`: `agent-readable`
   - Tags and entities extracted from content
3. Show the complete note (frontmatter + body) to the user:

```
"Here's the note I'll create:

**Path:** 01-wiki/[title].md

---
[frontmatter]
---

[body]

Shall I save this?"
```

4. Wait for explicit approval
5. On approval: call the appropriate write tool
6. Confirm: show the written path
7. Offer to update index files in `07-indexes/`

---

## Flow B: AI-Assisted (with editing)

For when the user provides raw material and wants the agent to structure it.

1. Read the raw content
2. Restructure: organize sections, extract key concepts, identify entities
3. Generate frontmatter (same fields as Flow A, but `source_type: agent`)
4. Present the DRAFT to the user:

```
"Here's my draft for your review:

**Path:** 01-wiki/[title].md

---
[frontmatter]
---

[structured body]

**Changes I made:**
- [list of structural changes]

Please review. You can:
- Approve as-is
- Request specific changes
- Reject and start over"
```

5. If the user requests changes: apply them, show updated draft
6. Repeat until approved (max 3 iterations, then ask if user wants to take over)
7. On approval: call the appropriate write tool
8. Confirm: show the written path
9. Offer to update index files in `07-indexes/`

---

## Frontmatter Reference

Minimum required fields for any new note:

```yaml
id: [type]-[slug]           # e.g. wiki-graph-rag, mem-2026-04-04-user-prefers-x
type: [wiki-article|memory-fact|session]
title: [descriptive title]
aliases: []
tags: [relevant, tags]
entities: [related-entity-ids]
status: active
visibility: agent-readable
source_type: [human|agent]
review_status: [draft|reviewed]
created_at: [YYYY-MM-DD]
updated_at: [YYYY-MM-DD]
confidence: [high|medium|low]
```

## Important

- NEVER write without showing the user the full content first
- NEVER skip the approval step
- If the user says "just do it" without seeing content, still show a brief summary of what will be written
- For memory candidates: always include `evidence` field listing source sessions or context
- After writing, always offer to run `kb_update_index` to keep indexes current
