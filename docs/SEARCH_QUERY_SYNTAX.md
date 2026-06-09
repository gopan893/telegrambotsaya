# Search Query Syntax Guide

## Overview

The RAG knowledge base supports a rich query syntax combining natural language, filter expressions, and mode modifiers. This guide documents all available syntax features.

---

## Basic Keyword Search

Simple natural language queries return results from both vector and keyword indexes:

```
How do I configure the Slack connector?
Installation guide for Linux servers
Error handling in recipe execution
```

These queries are analyzed for intent and expanded automatically. No special syntax is required.

---

## Filter Syntax

Filters narrow the search using `@`-prefixed key:value expressions anywhere in the query string.

### Tag Filter (`@tag`)

```
@tag:configuration @tag:security
```

Exact match on document tags. Multiple tags AND together. Use comma for OR within a tag:

```
@tag:setup,configuration
```

### Type Filter (`@type`)

Filter by document type classification:

```
@type:text       @type:code        @type:image
@type:audio      @type:video       @type:link
```

### Source Filter (`@source`)

Filter by document origin:

```
@source:manual      @source:imported      @source:connector
@source:plugin      @source:recipe        @source:webhook_<name>
```

### Date Filter (`@created`, `@updated`)

Date-based filtering with comparison operators:

```
@created:>2026-01-01
@updated:>=2026-06-01
@created:2026-03-15..2026-06-15
```

Supported operators: `>`, `<`, `>=`, `<=`, and range via `..`.

### Negation

Prefix any filter with `-` to exclude:

```
@tag:deprecated -@tag:obsolete
@source:connector -@type:image
```

---

## Hybrid Mode

By default, the search engine runs in **hybrid mode**, combining vector similarity with keyword scoring. Explicit modes:

| Syntax | Behavior |
|--------|----------|
| `mode:hybrid` | (Default) Vector + keyword merged via RRF |
| `mode:vector` | Vector similarity only (embedding search) |
| `mode:keyword` | Keyword BM25 only (no embeddings) |
| `mode:semantic` | Vector search with query expansion |

Mode is set by including the mode keyword in the query:

```
mode:keyword Slack connector setup    ← keyword only
```

---

## Query Analysis Interpretation

Every query is analyzed before execution. The analysis produces:

### Intent Classification

| Intent | Description | Example Query |
|--------|-------------|---------------|
| `factoid` | Looking for a specific fact | "What is the default timeout?" |
| `instructional` | How-to or procedural | "How do I create a recipe?" |
| `exploratory` | Broad understanding | "Tell me about plugins" |
| `summarization` | Concise overview | "Summarize the security model" |

### Entity Extraction

Detected entities are available in the search response under `analysis.entities`:

```json
{
  "entities": {
    "people": ["Alice"],
    "dates": ["2026-06-01"],
    "topics": ["Slack", "connector"]
  }
}
```

### Query Expansion

If the query returns fewer than 3 results, the system automatically expands with synonyms. Expanded terms are shown in the response:

```json
{
  "analysis": {
    "expanded": true,
    "original_query": "Slack setup",
    "expanded_query": "Slack setup configuration installation guide"
  }
}
```

---

## Relevance Scoring

Results include a relevance breakdown:

```json
{
  "score": 0.87,
  "breakdown": {
    "vector_similarity": 0.45,
    "keyword_overlap": 0.22,
    "recency_boost": 0.08,
    "source_authority": 0.07,
    "personal_feedback": 0.05
  }
}
```

Scores are normalized to 0.0–1.0. Only results with `score >= 0.15` are returned (configurable).

---

## Pagination

| Parameter | Default | Max |
|-----------|---------|-----|
| `limit` | 10 | 50 |
| `offset` | 0 | 10,000 |

Add to query:

```
@limit:20 @offset:0
```

---

## Feedback Recording

After viewing results, users can submit relevance feedback:

### Via API

```json
POST /api/knowledge/feedback
{
  "query": "Slack connector setup",
  "results": [
    { "doc_id": "doc_abc", "relevant": true },
    { "doc_id": "doc_def", "relevant": false }
  ]
}
```

### Via Query Parameter

Append `--feedback` to trigger a feedback prompt in the Dashboard after results display:

```
Slack connector setup --feedback
```

### Via Button (Dashboard)

Each result card has thumbs-up / thumbs-down buttons. Clicking either immediately records feedback and adjusts the relevance score for subsequent queries.

---

## Examples

| Query | Description |
|-------|-------------|
| `@tag:setup @source:manual` | Manual docs tagged "setup" |
| `mode:keyword @type:code` | Code-only keyword search |
| `How to configure webhooks @created:>2026-03-01` | Recent webhook guides |
| `@source:connector -@tag:deprecated` | Active connector docs |
| `@tag:security,authentication mode:hybrid @limit:5` | Top 5 hybrid results on security topics |
