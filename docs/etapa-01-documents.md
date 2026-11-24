# Etapa 1 — Documents

- **Data:** 2026-11-24
- **Status:** concluída
- **Objetivo:** receber documentos TXT/Markdown, extrair o texto, persistir e listar.

## O que foi implementado

- `DocumentsModule` com controller, service e entidade.
- `POST /documents` em `multipart/form-data`, campo `file`, limite de 5 MB.
- Formatos aceitos: `.txt`, `.md` e `.markdown`.
- Extração de texto com validação de UTF-8, remoção de BOM, normalização de quebras de linha e `trim`.
- Nome do arquivo reduzido ao basename, evitando caminhos vindos do cliente.
- Entidade `Document` e migration `CreateDocuments`.
- `GET /documents` retornando metadados, sem carregar o conteúdo, do mais recente para o mais antigo.
- `autoLoadEntities` reativado na conexão da aplicação, agora que existe uma entidade.
- 10 testes unitários novos: 7 de extração e 3 do service.
- Testes manuais de upload, persistência, listagem e erros HTTP.

## Estrutura adicionada

| Caminho | Responsabilidade |
|---|---|
| `src/documents/documents.module.ts` | Agrupa controller, service e entidade. |
| `src/documents/documents.controller.ts` | `POST /documents` e `GET /documents`. |
| `src/documents/documents.service.ts` | Orquestra extração, persistência e listagem. |
| `src/documents/text-extraction.ts` | Valida extensão e UTF-8; normaliza o texto. |
| `src/documents/text-extraction.spec.ts` | Testes da extração. |
| `src/documents/documents.service.spec.ts` | Testes do service com repositório mockado. |
| `src/documents/entities/document.entity.ts` | Mapeamento da tabela `documents`. |
| `src/database/migrations/1795478400001-CreateDocuments.ts` | Cria a tabela `documents`. |

Arquivos ajustados:

- `src/app.module.ts` — importa `DocumentsModule`.
- `src/database/typeorm.config.ts` — `autoLoadEntities: true`.
- `tsconfig.json` — adiciona os tipos de `multer`.
- `package.json` — `@types/multer` como devDependency.

## Modelo de dados

```sql
CREATE TABLE documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename   text NOT NULL,
  mime_type  text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

O texto completo fica em `content` para alimentar o chunking nas próximas etapas. A listagem não retorna esse campo.

## Fluxo

```text
POST /documents
multipart → FileInterceptor (limite 5 MB) → DocumentsService
  → extractText (extensão, UTF-8, BOM, CRLF, trim)
  → repository.save
  → 201 { id, filename, mimeType, characters, createdAt }

GET /documents
→ repository.find (metadados, sem content, created_at DESC)
→ 200 [{ id, filename, mimeType, createdAt }]
```

## Decisões

- **Memory storage do Multer:** o binário não é armazenado; apenas o texto extraído vai para o banco. O limite de 5 MB protege a memória.
- **Extensão como fonte de verdade:** o MIME enviado pelo cliente é pouco confiável (`.md` pode chegar como `application/octet-stream`). Validamos a extensão e derivamos o MIME (`text/plain` ou `text/markdown`).
- **UTF-8 estrito:** `TextDecoder` com `fatal: true` rejeita arquivos binários disfarçados. Codificações como Latin-1 são recusadas com 422 nesta etapa; detecção de encoding fica para depois.
- **Conteúdo completo persistido:** necessário para o chunking; a listagem exclui `content` para não trafegar textos grandes.
- **Sem chunking ainda:** cada documento é uma unidade. Chunks e embeddings entram nas próximas etapas.
- **Sem e2e automatizado ainda:** a verificação foi feita com testes unitários e chamadas reais à API. Testes e2e entram quando houver um banco de teste dedicado.
- **Sem endpoint de detalhe ou deleção:** o escopo é upload e listagem. Ambos podem ser adicionados quando houver necessidade real.

## Verificação

- 16 testes unitários no total, todos passando.
- `npm run typecheck`, `npm run lint` e `npm run build` passando.
- Migration aplicada; tabela `documents` criada com PK e tipos corretos.
- Upload de `outbox.txt` e `notes.md`: `201`, conteúdo armazenado e `createdAt` retornado.
- `GET /documents`: os dois documentos, ordenados do mais recente para o mais antigo.
- Erros confirmados: `400` sem arquivo, `413` acima de 5 MB, `415` para `.pdf`, `422` para arquivo vazio e `422` para UTF-8 inválido.
- Nome `../../evil.txt` foi persistido como `evil.txt`.
- `GET /health` continuou retornando `200`.
- Dados de teste removidos com `TRUNCATE documents` ao final.

## Conceitos praticados

- `multipart/form-data` e upload em memória com `FileInterceptor`.
- Extração de texto como função pura, sem I/O e fácil de testar.
- Camadas de validação: tamanho no Multer, presença no controller, tipo/encoding na extração, persistência no banco.
- Diferença entre metadados de documento e conteúdo completo.
- Entidade TypeORM, repositório e migration.
- `autoLoadEntities` e o momento em que a entidade passa a existir.

## Fora do escopo

- Chunking.
- Embeddings e tabela `chunks`.
- Busca vetorial.
- Chat e prompt.
- Endpoint de detalhe, deleção e e2e.

## Próxima etapa

**Etapa 2 — Chunking:** criar uma função pura e configurável que divide o texto em trechos com overlap, com testes de borda. A persistência dos chunks e os embeddings entram na etapa seguinte.
