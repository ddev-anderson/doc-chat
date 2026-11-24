# Project history

A short record of each stage: what was implemented, the structure added, the decisions and how to verify it.

> The detailed stage notes are currently written in Portuguese; this index summarizes them in English.

| Stage | Status | Summary |
|---|---|---|
| [Stage 0 — Foundation](etapa-00-fundacao.md) | Completed on 2026-11-24 | NestJS, PostgreSQL/pgvector, validated configuration, migration and health check. |
| [Stage 1 — Documents](etapa-01-documents.md) | Completed on 2026-11-24 | TXT/Markdown upload, UTF-8 extraction, persistence and document listing. |
| [Stage 2 — Chunking](etapa-02-chunking.md) | Completed on 2026-11-24 | Pure, configurable chunking function with overlap and edge-case tests. |
| [Stage 3 — Embeddings](etapa-03-embeddings.md) | Completed on 2026-11-24 | Local Ollama with `bge-m3`, `chunks` table and transactional ingestion with 1024-dimensional vectors. |
| [Stage 4 — Retrieval](etapa-04-retrieval.md) | Completed on 2026-11-24 | Similarity search in pgvector with query embedding, top-k, calibrated threshold and an inspection endpoint. |
| [Stage 5 — Chat](etapa-05-chat.md) | Completed on 2026-11-24 | Context prompt, DeepSeek via the OpenAI SDK, structural sources and no-context refusal. |

## Next steps

1. Review, experiments and evaluation.

Each completed stage has an `etapa-XX-name.md` file with the same structure: goal, implementation, architecture, decisions, verification and open points. The project README is [here](../README.md).
