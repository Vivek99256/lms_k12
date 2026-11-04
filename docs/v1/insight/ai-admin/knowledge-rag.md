# Knowledge & RAG

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Manage the document knowledge base used for Retrieval-Augmented Generation (RAG). Administrators upload, index, and organise documents so the AI assistant can answer questions grounded in institute-specific content (policies, syllabi, circulars, handbooks).

---

## Menu path

AI Administration → Knowledge & RAG

---

## Frontend route

| Route | Notes |
|---|---|
| `/ai/knowledge-rag` | Registry status: `in-progress` |

---

> **Status:** Core upload and indexing pipeline is in progress. The chatbot can already reference a basic knowledge base; advanced retrieval (chunking strategies, hybrid search, re-ranking) is under active development.

---

## Knowledge base structure

A knowledge base is a named collection of documents scoped to a module or the entire institute:

| Field | Notes |
|---|---|
| Name | Display name |
| Scope | `institute`, or a specific module key |
| Embedding model | Selected from the models catalogue (must have embedding capability flag) |
| Chunk strategy | `paragraph` / `sentence` / `fixed-token` |
| Status | `building` / `ready` / `error` |

---

## Document lifecycle

1. **Upload** — PDF, DOCX, TXT, or Markdown. MIME type and size are validated against `MAX_UPLOAD_BYTES` before upload to Laravel.
2. **Chunk** — the document is split into chunks according to the knowledge base's chunk strategy.
3. **Embed** — each chunk is passed to the configured embedding model and stored as a vector.
4. **Index ready** — the knowledge base status changes to `ready`; the chatbot can now retrieve from it.
5. **Re-index** — triggered automatically when the embedding model changes, or manually by the administrator.

---

## Retrieval at query time

When the chatbot receives a question:

1. The question is embedded using the same model as the knowledge base.
2. Cosine similarity search returns the top-k most relevant chunks.
3. The retrieved chunks are injected into the system prompt as context.
4. The model answers using both its own knowledge and the retrieved context.

---

## Neo4j knowledge graph (product-specific)

A separate `knowledge-graph` capability (also `in-progress`) builds a Neo4j graph from indexed content. The RAG pipeline can optionally use graph traversal to augment similarity search with entity relationships. This is configured separately; see the registry entry for `knowledge-graph`.

---

## RBAC

| Action | Required right |
|---|---|
| View knowledge bases | `ai_intelligence.knowledge-rag` |
| Create / edit knowledge base | `ai_intelligence.knowledge-rag` (write) |
| Upload documents | `ai_intelligence.knowledge-rag` (write) |
| Delete documents | `ai_intelligence.knowledge-rag` (write) |

---

## Related capabilities

- `models` — embedding model selected per knowledge base
- `conversational` — chatbot draws on indexed knowledge bases
- `knowledge-graph` — graph-based retrieval augmentation (in-progress)
- `audit` — document uploads and re-index events are logged

---

## Source files

- Registry: `packages/ai-intelligence-core/src/registry.ts` (capability `knowledge-rag`, status `in-progress`)
- Backend: Laravel knowledge base and vector storage controllers
