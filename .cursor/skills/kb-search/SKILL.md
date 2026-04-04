---
name: kb-search
description: >-
  Search and retrieve knowledge from the KB. Use when the user asks a question
  about a topic that might be in the knowledge base, asks to find, search, look
  up information, or says "what do we know about...", "find in KB", "check KB".
---

# Search and Retrieve Knowledge

## When to Use

- User asks a factual question that the KB might answer
- User explicitly asks to search or look up something in the KB
- User references a project, person, concept, or decision that likely has a KB entry

## Procedure

### Step 1: Extract Search Intent

From the user's query, identify:
- Key entities (project names, people, concepts)
- Topic area (if clear)
- Whether this is a broad exploration or a specific lookup

### Step 2: Choose Search Strategy

**Specific entity known** (e.g. "tell me about GraphRAG"):
```
Call kb_get_entity with the entity name/ID
```

**Broad question** (e.g. "what decisions did we make about retrieval?"):
```
Call kb_context_search with the query
Optionally pass entity_hints if you can extract entity IDs
```

**Targeted by type** (e.g. "list all project notes"):
```
Call kb_search with types filter (e.g. types: ["project"])
```

### Step 3: Handle Results

**0 results:**
- Tell the user: "The KB has no information on [topic]."
- Do NOT fabricate an answer from general knowledge.
- Optionally suggest: "Would you like me to add information about this topic to the KB?"

**1-8 results (clear match):**
- Synthesize an answer using the retrieved content.
- Cite every source: `(source: note-id)` or link to the path.
- If results partially answer the question, explicitly state what the KB covers and what it doesn't.

**Many results across different topics (>15 or clearly spanning unrelated areas):**
- Do NOT dump all results. Ask the user to narrow down:

```
Use AskQuestion:
  prompt: "I found N results spanning several areas. Which topic are you looking for?"
  options:
    - [Topic A based on result clusters]
    - [Topic B based on result clusters]
    - "Show me everything"
```

- After the user narrows, re-search or filter results accordingly.

**Results exist but low confidence (weak matches, tangential hits):**
- Present what was found with a caveat: "The KB has some tangentially related content, but nothing directly on [topic]."
- Ask if the user wants to see the partial matches.

### Step 4: Offer Follow-Up

After answering, if the interaction revealed gaps or new facts:
- Offer to create a memory candidate for new insights
- Offer to update index files if the query revealed a missing index entry

## Important

- ALWAYS search before answering. Never skip the KB lookup.
- NEVER blend KB facts with invented information.
- When citing, use the note's `id` field or vault-relative path.
- Respond in the user's language.
