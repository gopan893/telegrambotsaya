# Personal Knowledge Search & RAG

## Overview

The RAG (Retrieval-Augmented Generation) Knowledge Base enables semantic search over personal documents, notes, and external content. It combines vector embeddings with keyword indexing to provide contextually relevant results within strict token budgets.

---

## Architecture

```
User Query → Query Analyzer → Hybrid Search
                                  ├── Vector Index (embedding similarity)
                                  └── Keyword Index (BM25 / FTS5)
                                      ↓
                              Context Builder (token budget)
                                      ↓
                              LLM Prompt (with retrieved chunks)
```

---

## Document Store

Documents are stored as structured records:

```json
{
  "id": "doc_abc123",
  "source": "manual",
  "title": "Installation Guide",
  "content": "...",
  "metadata": {
    "type": "text",
    "tags": ["setup", "configuration"],
    "created": "2026-01-15T10:00:00Z",
    "updated": "2026-06-01T14:30:00Z"
  },
  "checksum": "sha256:..."
}
```

Supported source types: `manual` (user-created), `imported`, `connector`, `plugin`, `recipe`.

---

## Chunking Strategies

| Strategy | Description | Default Chunk Size | Overlap |
|----------|-------------|--------------------|---------|
| **Paragraph** | Splits on `\n\n` boundaries, preserves semantic blocks | 512 tokens | 0 |
| **Sentence** | Splits on sentence boundaries (NLP-based) | 256 tokens | 32 tokens |
| **Token** | Fixed-size token windows with configurable overlap | 384 tokens | 64 tokens |
| **Recursive** | Recursive splitter - tries paragraph, then sentence, then token | 512 tokens | 64 tokens |

The chunking strategy is configurable per document source at indexing time.

---

## Embedding Service

- **Provider**: Configurable (default: local `all-MiniLM-L6-v2` via ONNX)
- **Dimension**: 384 (local) / 1536 (OpenAI) / 768 (Cohere)
- **Batch size**: 32 chunks per request
- **Cache**: LRU cache of 10,000 embeddings (memory-mapped)
- **Fallback**: If remote embedding API is unavailable, falls back to local model

---

## Vector Index

- **Engine**: FAISS (FlatIP index for exact search) with optional HNSW for approximate search
- **Dimensions**: Matches embedding model dimension
- **Index persistence**: Snapshot every 500 writes, journal for crash recovery
- **Hybrid mode**: Results are normalized and merged with keyword scores (weight: 70% vector, 30% keyword by default)

---

## Hybrid Search

Executes two searches in parallel and merges results via reciprocal rank fusion (RRF):

```text
score = (1 / (rank_vector + k)) + (1 / (rank_keyword + k))
```

Where `k = 60` (default). Top `n` results by fused score are returned.

---

## Context Builder

Assembles retrieved chunks into a prompt-sized context window:

1. Rank chunks by relevance score (descending)
2. Deduplicate overlapping chunks (keep highest-scored)
3. Truncate from the bottom until within token budget
4. Preserve chunk metadata (source, title, tags) in context markers

**Token budget**: Configurable per query (default 2,048 tokens, max 4,096).

---

## Filter Engine

Filters narrow the search space before or after retrieval:

| Filter Syntax | Example | Behavior |
|---------------|---------|----------|
| `@tag:value` | `@tag:setup` | Exact tag match |
| `@type:text` | `@type:code` | Document type filter |
| `@source:manual` | `@source:connector` | Source origin filter |
| `@created:date` | `@created:>2026-01-01` | Date range (>, <, >=, <=) |

Multiple filters AND together. Prefix `-` for negation (e.g., `-@tag:deprecated`).

---

## Query Analysis

Each query is analyzed before search:

1. **Entity extraction**: Identify people, dates, topics
2. **Intent classification**: `factoid`, `instructional`, `exploratory`, `summarization`
3. **Query expansion**: Add synonyms for low-coverage terms
4. **Filter extraction**: Parse inline `@filter` syntax

Analysis results are logged for tuning and are visible in the Dashboard debug view.

---

## Relevance Scoring

| Factor | Weight | Description |
|--------|--------|-------------|
| Vector similarity | 0.50 | Cosine similarity of embeddings |
| Keyword overlap | 0.25 | BM25 term frequency match |
| Recency boost | 0.10 | Logarithmic decay over 30 days |
| Source authority | 0.10 | Manual > imported > connector |
| Personal feedback | 0.05 | User upvote/downvote history |

---

## Feedback Loop

Users can mark results as helpful / not helpful:

- Upvotes increase the source authority weight for that document
- Downvotes decrease it and trigger re-ranking penalty for similar queries
- Feedback is stored per-user in `knowledge/feedback.json`

The feedback data is used in a weekly offline job to fine-tune embedding weights and adjust the RRF `k` parameter.

---

## Caching

| Cache | TTL | Storage |
|-------|-----|---------|
| Query result cache | 5 minutes | In-memory LRU (1,000 entries) |
| Embedding cache | 1 hour | Memory-mapped file |
| Vector index | N/A (persistent) | FAISS index on disk |
| Document content | 10 minutes | In-memory LRU (500 entries) |

Cache is invalidated when the underlying document set changes (add/edit/delete).

---

## Security & Privacy

- All document content is stored encrypted at rest (AES-256-GCM)
- Embeddings are stored in a separate namespaced index per user
- The embedding service never transmits content to external providers unless explicitly configured
- Query logs are anonymized after 7 days
- Document deletion triggers immediate removal from both index and store
