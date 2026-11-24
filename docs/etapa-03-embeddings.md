# Etapa 3 — Embeddings

- **Data:** 2026-11-24
- **Status:** concluída
- **Objetivo:** transformar cada chunk em um vetor usando Ollama local e persistir documento + chunks de forma transacional.

## O que foi implementado

- Ollama local com o modelo `bge-m3` (1024 dimensões).
- `EmbeddingsModule` e `EmbeddingsService` usando o SDK `openai` contra o endpoint compatível do Ollama: `http://127.0.0.1:11434/v1/embeddings`.
- Geração em lotes com `EMBEDDINGS_BATCH_SIZE`.
- Métodos `embedDocuments()` e `embedQuery()`, preparando a Etapa 4.
- Validação da quantidade de vetores e da dimensão retornada.
- Mapeamento de erros do provedor para `503`, `504` e `502`.
- Entidade `Chunk` e migration `CreateChunks`.
- Integração no upload: extração → chunking → embeddings → transação com documento e chunks.
- Resposta do `POST /documents` agora inclui a quantidade de chunks.
- Variáveis `CHUNK_SIZE`, `CHUNK_OVERLAP` e `EMBEDDINGS_*` validadas no boot.
- Ajuste no chunking: o overlap começa em fronteira de palavra quando possível.

## Estrutura adicionada

| Caminho | Responsabilidade |
|---|---|
| `src/embeddings/embeddings.service.ts` | Cliente de embeddings, lotes, validação de dimensão e erros. |
| `src/embeddings/embeddings.module.ts` | Provider do cliente OpenAI-compatible e exportação do service. |
| `src/embeddings/embeddings.service.spec.ts` | Testes de lotes, ordem, dimensão e falha de conexão. |
| `src/documents/entities/chunk.entity.ts` | Mapeamento da tabela `chunks`, incluindo `number[]` na coluna vetorial. |
| `src/database/migrations/1795478400002-CreateChunks.ts` | Cria a tabela `chunks`, FK, unicidade e índice. |

Arquivos ajustados:

- `src/documents/documents.service.ts` — chunking, embeddings e transação.
- `src/documents/documents.module.ts` — importa `EmbeddingsModule` e registra `Chunk`.
- `src/config/env.validation.ts` — novas variáveis e validação de overlap.
- `.env` / `.env.example` — configuração local do Ollama e do chunking.
- `package.json` — SDK `openai` de volta como dependência.

## Modelo de dados

```sql
CREATE TABLE chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  embedding   vector(1024) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX ON chunks (document_id);
```

O TypeORM 1.x suporta colunas `vector` nativamente: um `number[]` é serializado para o formato do pgvector na escrita e hidratado de volta na leitura.

## Fluxo

```text
POST /documents
→ extrair texto
→ chunkText(CHUNK_SIZE, CHUNK_OVERLAP)
→ EmbeddingsService.embedDocuments (lotes de 16)
→ transaction:
    INSERT document
    INSERT chunks (document_id, chunk_index, content, embedding)
→ 201 { id, filename, mimeType, characters, chunks, createdAt }
```

Os embeddings são gerados **antes** da transação. Se o provedor falhar, nenhum documento é criado; se o insert falhar, a transação reverte documento e chunks.

## Decisões

- **Ollama local com `bge-m3`:** sem custo por token e com 1024 dimensões. O modelo tem contexto de 8192 tokens, folgado para chunks de ~300 tokens.
- **SDK `openai` contra o endpoint compatível:** o Ollama expõe `/v1/embeddings`; o SDK é o mesmo que será usado para o chat (DeepSeek via `baseURL`). A chave `ollama` é fictícia, mas o SDK exige um valor não vazio.
- **Provider do cliente em um token (`OPENAI_CLIENT`):** separa a criação do cliente da lógica de embeddings e permite injetar um dublê nos testes.
- **Lotes configuráveis:** menos requisições e melhor uso local; a ordem é restaurada pelo `index` da resposta.
- **Validação de dimensão:** evita gravar vetores incompatíveis com `vector(1024)` e detecta cedo a troca de modelo.
- **Transação depois dos embeddings:** não mantém uma transação aberta durante chamadas externas.
- **Erros mapeados:** conexão recusada vira `503`; timeout, `504`; erro HTTP do provedor, `502`. Nada disso persiste dados.
- **Dimensão fixa:** trocar o modelo para um vetor de outra dimensão exige nova migration e reindexação do corpus.
- **Sem índice HNSW ainda:** a busca vetorial é o foco da Etapa 4; primeiro garantimos ingestão e armazenamento corretos.
- **Ingestão síncrona:** agora ela inclui chamadas de embedding e fica mais lenta. Fila/processamento assíncrono continua fora do escopo.

## Verificação

- 34 testes unitários em 6 arquivos, todos passando.
- `typecheck`, `lint` e `build` passando.
- Migration aplicada; tabela `chunks` com `vector(1024)`, FK `ON DELETE CASCADE`, unicidade `(document_id, chunk_index)` e índice.
- Upload de `long.txt` com 3718 caracteres: `201`, 4 chunks.
- Tamanhos dos chunks: 1114, 1084, 1084 e 898 caracteres (limite de 1200).
- `vector_dims(embedding)`: 1024 em todos os chunks.
- Overlap passou a começar em palavra limpa (`"armazena..."`), não no meio.
- Teste de falha com `EMBEDDINGS_BASE_URL` apontando para uma porta morta: `503` e **0 documentos / 0 chunks** no banco.
- `GET /health` continuou retornando `200`.
- Dados de teste removidos; banco vazio ao final.

## Conceitos praticados

- Embedding como vetor de dimensão fixa e o contrato de dimensão com o schema.
- Batching e ordenação de respostas.
- Armazenamento de vetores no PostgreSQL com TypeORM + pgvector.
- Embeddings antes da transação; atomicidade documento + chunks.
- Mapeamento de falhas de provedor externo para respostas HTTP.
- Endpoint compatível com OpenAI como camada de interoperabilidade.

## Limitações

- Qualidade e latência dependem do modelo local e da máquina.
- Ingestão síncrona: documentos grandes geram muitas chamadas de embedding.
- Sem índice vetorial: a Etapa 4 vai decidir entre busca exata e HNSW.
- Dimensão fixa em 1024; trocar de modelo exige migration e reindexação.
- Sem retry sofisticado; `EMBEDDINGS_MAX_RETRIES` é configurável e o padrão é 0.
- Sem normalização explícita no armazenamento; a similaridade de cosseno funciona independentemente da magnitude.

## Fora do escopo

- Busca vetorial e top-k.
- Índice HNSW.
- Retrieval e chat.
- Reranking.

## Próxima etapa

**Etapa 4 — Retrieval:** usar `embedQuery` para gerar o embedding da pergunta, buscar os chunks mais próximos com o operador `<=>` do pgvector, aplicar top-k e threshold e expor um endpoint de busca para inspeção. O índice vetorial entra quando houver volume que justifique.
