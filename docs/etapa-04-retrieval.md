# Etapa 4 — Retrieval

- **Data:** 2026-11-24
- **Status:** concluída
- **Objetivo:** transformar uma pergunta em embedding e recuperar os chunks mais similares do pgvector, com top-k e threshold.

## O que foi implementado

- `RetrievalModule`, `RetrievalService`, controller e DTO.
- `POST /retrieval/search` retornando `200` com `{ query, results }`.
- Query normalizada e enviada ao `EmbeddingsService.embedQuery()` (bge-m3, 1024 dimensões).
- Busca por distância de cosseno no pgvector com o operador `<=>`.
- `JOIN` com `documents` para devolver `filename`.
- Top-k configurável e threshold de similaridade.
- Resultado com `chunkId`, `documentId`, `filename`, `chunkIndex`, `content` e `score`.
- Validação do body com `class-validator` e `ValidationPipe` global.
- 4 testes unitários novos do service.

## Estrutura adicionada

| Caminho | Responsabilidade |
|---|---|
| `src/retrieval/retrieval.module.ts` | Agrupa controller e service; exporta o service para o futuro Chat. |
| `src/retrieval/retrieval.controller.ts` | `POST /retrieval/search`. |
| `src/retrieval/retrieval.service.ts` | Embedding da pergunta, SQL de similaridade, top-k e threshold. |
| `src/retrieval/retrieval.dto.ts` | Validação de `query`, `topK` e `minScore`. |
| `src/retrieval/retrieval.service.spec.ts` | Testes de busca, threshold, overrides e query vazia. |

Arquivos ajustados:

- `src/app.module.ts` — importa `RetrievalModule`.
- `src/main.ts` — `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`).
- `src/config/env.validation.ts` — `RETRIEVAL_TOP_K` e `RETRIEVAL_MIN_SCORE`.
- `.env` / `.env.example` — configuração de retrieval.
- `package.json` — `class-validator` e `class-transformer`.

## Fluxo

```text
POST /retrieval/search
{ query, topK?, minScore? }
→ ValidationPipe
→ RetrievalService
→ embedQuery (Ollama/bge-m3)
→ SQL no pgvector:
    ORDER BY embedding <=> $1::vector
    LIMIT $2
→ filtro de score no service
→ { query, results: [{ chunkId, documentId, filename, chunkIndex, content, score }] }
```

A SQL executada:

```sql
SELECT
  c.id AS "chunkId",
  c.document_id AS "documentId",
  d.filename AS "filename",
  c.chunk_index AS "chunkIndex",
  c.content AS "content",
  1 - (c.embedding <=> $1::vector) AS "score"
FROM chunks c
JOIN documents d ON d.id = c.document_id
ORDER BY c.embedding <=> $1::vector
LIMIT $2;
```

O vetor da pergunta é passado como literal (`[0.1,0.2,...]`) e convertido com `::vector`. A ordenação é por distância crescente; `score` é a similaridade (`1 - distância`).

## Decisões

- **Busca exata, sem índice vetorial:** o corpus é pequeno; a varredura compara com todos os chunks e tem recall de 100%. HNSW/IVFFlat entram quando houver volume que justifique.
- **Threshold calibrado em 0,5:** com o corpus de teste, chunks relevantes ficaram em ~0,65–0,69 e irrelevantes em ~0,21–0,29. O valor é específico para este modelo e corpus; é configurável e não deve ser tratado como universal.
- **Threshold aplicado no service:** a SQL busca o top-k; o service filtra por `score >= minScore`. Isso permite devolver `[]` quando nada é relevante e deixa a semântica explícita. Futuramente, com índice, o filtro pode ser avaliado no SQL.
- **Top-k padrão 5:** equilíbrio entre recall, ruído e custo de contexto para o Chat.
- **Score não é probabilidade:** é similaridade de cosseno. Serve para ranking e threshold, não como confiança.
- **Endpoint de debug:** o Chat vai consumir `RetrievalService` diretamente; `POST /retrieval/search` existe para inspecionar scores e testar a busca sem LLM.
- **Validação na borda:** o DTO limita `query` a 2000 caracteres, `topK` a 1–50 e `minScore` a -1–1. O service ainda rejeita query vazia após `trim`.
- **Sem HNSW ainda:** primeiro medir a busca exata; o índice é uma otimização com trade-off de memória e recall.

## Verificação

- 38 testes unitários em 7 arquivos, todos passando.
- `typecheck`, `lint` e `build` passando.
- Banco vazio retornando `[]`.
- Corpus de teste com três documentos: `outbox.txt` (4 chunks), `pgvector.txt` e `culinaria.txt`.
- Consulta “Como funciona o padrão Outbox?”: 4 chunks, todos de `outbox.txt`, scores 0,6692 / 0,6574 / 0,6560 / 0,6557.
- Consulta “O que é pgvector e para que serve?”: top-1 `pgvector.txt`, score 0,6916.
- Consulta “Qual é a receita de bolo de cenoura?”: top-1 `culinaria.txt`, score 0,6739.
- Consulta “Qual é a capital da França?”: com threshold 0,5, retornou `[]`; com `minScore: 0`, os melhores scores ficaram em ~0,21–0,27.
- `topK: 1` retornou apenas o chunk mais próximo.
- Validações confirmadas: query vazia, `topK: 100`, campo desconhecido e body sem `query` retornaram `400`.
- Upload de documento continuou funcionando após o `ValidationPipe` global (`201`).
- Dados de teste removidos; banco vazio ao final.

## Conceitos praticados

- Distância de cosseno e similaridade (`1 - distância`).
- Top-k: quantidade de candidatos recuperados.
- Threshold: filtro de relevância dependente do modelo e do corpus.
- Busca exata versus busca aproximada com índice.
- O embedding da pergunta precisa usar o mesmo modelo e dimensão dos chunks.
- Scores são relativos; não são probabilidades.

## Limitações

- Threshold é calibrado para este corpus; outro domínio exige nova calibração.
- Busca densa pode perder termos exatos, IDs e código; busca híbrida fica para depois.
- Sem reranking: a ordem por distância não é necessariamente a ordem mais útil para o LLM.
- Sem índice vetorial: custo O(n) por consulta.
- Sem deduplicação por documento: vários chunks do mesmo documento podem aparecer.
- Query limitada a 2000 caracteres.

## Fora do escopo

- Prompt e geração com LLM.
- HNSW/IVFFlat.
- Busca híbrida e reranking.
- Memória conversacional.

## Próxima etapa

**Etapa 5 — Chat:** montar o prompt com os chunks recuperados, chamar o LLM (DeepSeek via SDK `openai` e `baseURL` customizado), devolver a resposta com as fontes e tratar o caso “não há contexto suficiente”. O endpoint de retrieval deixa de ser o foco e passa a alimentar o serviço de Chat.
