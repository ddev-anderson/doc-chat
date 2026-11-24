# Etapa 0 — Fundação

- **Data:** 2026-11-24
- **Status:** concluída
- **Objetivo:** ter uma base executável e verificável, ainda sem nenhuma lógica de RAG.

## O que foi implementado

- Scaffold NestJS 12 em ESM, TypeScript strict, Vitest e Oxlint.
- PostgreSQL 17 com a extensão `pgvector` via Docker Compose.
- Validação de ambiente no boot com Joi, falhando rápido e listando todas as variáveis ausentes.
- Conexão TypeORM 1.x com o banco.
- Migration `EnableVectorExtension`, que executa `CREATE EXTENSION vector`.
- Script único de migrations (`migrate.ts`) com `run` e `revert`, executado via `tsx`.
- `GET /health` verificando o banco e a versão da extensão `vector`, com resposta `200` ou `503`.
- Testes unitários da validação de ambiente e do health check.
- Build enxuto: `dist/` apenas com `.js`, sem source maps, `.d.ts` ou cache incremental.
- Histórico em `docs/`.

## Estrutura adicionada

| Caminho | Responsabilidade |
|---|---|
| `src/main.ts` | Bootstrap HTTP, shutdown hooks e porta. |
| `src/app.module.ts` | Composition root: configuração, TypeORM e health. |
| `src/config/env.validation.ts` | Schema Joi e `validateEnv`. |
| `src/config/env.validation.spec.ts` | Testes da validação de ambiente. |
| `src/database/typeorm.config.ts` | Opções de conexão usadas pela aplicação. |
| `src/database/data-source.ts` | `DataSource` usado pelas migrations; carrega o `.env` fora do Nest. |
| `src/database/migrate.ts` | Executa `run` e `revert` das migrations. |
| `src/database/migrations/1795478400000-EnableVectorExtension.ts` | Habilita a extensão `vector`. |
| `src/health/health.controller.ts` | Expõe `GET /health`. |
| `src/health/health.service.ts` | Consulta o banco e o `pg_extension`. |
| `src/health/health.service.spec.ts` | Testes de sucesso e falha do health. |
| `docker-compose.yml` | PostgreSQL 17 + pgvector, volume e healthcheck. |
| `.env.example` | Variáveis de ambiente da etapa. |
| `README.md` | Setup, scripts e operação. |
| `tsconfig.json` / `tsconfig.build.json` | Configuração TypeScript e build. |
| `vitest.config.ts` | Configuração dos testes unitários. |

## Fluxo

```text
Boot
.env → validateEnv → ConfigService → TypeORM DataSource → AppModule

Health
GET /health → HealthController → HealthService → PostgreSQL
                                               ├─ SELECT 1
                                               └─ SELECT extversion
                                                  FROM pg_extension

Migrations
npm run migration:run → migrate.ts → data-source.ts → CREATE EXTENSION vector
```

## Decisões

- **NestJS 12 em ESM:** o projeto segue o padrão atual do framework; imports relativos terminam em `.js` e `import.meta.dirname` substitui `__dirname`.
- **Validação com `validate` em vez de `validationSchema`:** o `@nestjs/config` 12 passou a usar Standard Schema; a função explícita com Joi permite controlar `allowUnknown` e `abortEarly`.
- **TypeORM 1.x com migrations programáticas:** o CLI antigo não é necessário; `tsx` executa `migrate.ts` com `runMigrations()` e `undoLastMigration()`.
- **`synchronize: false` desde o início:** o schema evolui apenas por migration.
- **Health customizado:** duas queries não justificam o Terminus nesta etapa.
- **Sem LLM nem embeddings nesta etapa:** não há chamada a provedor. O SDK e as variáveis entram quando a etapa que os usa for implementada. Decisão registrada: DeepSeek via SDK `openai`; embeddings em provedor separado (o DeepSeek não oferece embeddings).
- **Build enxuto:** source maps, declarações e cache incremental desligados. O `dist` tem 9 arquivos `.js` (36 K). O trade-off é que stack traces apontam para JavaScript; para depurar em TypeScript, basta habilitar `sourceMap` no `tsconfig.build.json`.
- **Limpeza do scaffold:** `@nestjs/observe`, `@nestjs/mau` e arquivos de agentes gerados automaticamente foram removidos por não agregarem ao objetivo.

## Verificação

- 6 testes unitários passando.
- `npm run typecheck`, `npm run lint` e `npm run build` passando.
- Migration aplicada, revertida e reaplicada.
- `/health` retornou `200`; com o banco parado, `503`; após reiniciar, `200`.
- Boot sem variáveis obrigatórias: exit 1 com a lista de ausentes.
- Argumento inválido no `migrate.ts`: mensagem de uso e exit 1.
- `dist` sem `.map`, sem `.d.ts` e sem `.tsbuildinfo`.

## Conceitos praticados

- Módulos e injeção de dependência do Nest.
- Configuração 12-factor e fail-fast.
- `DataSource` versus repositório (repositórios entram com as entidades).
- Migrations versus `synchronize`.
- pgvector como extensão do PostgreSQL, não serviço separado.
- Health check de dependências versus erro de configuração.
- SDK versus provedor: o `baseURL` define quem responde.

## Fora do escopo

- Upload e documentos.
- Chunking.
- Embeddings e tabela de chunks.
- Busca vetorial e retrieval.
- Chat e prompt.
- Testes e2e e configuração de provedores.

## Próxima etapa

**Etapa 1 — Documents:** upload de TXT/Markdown, extração de texto, persistência e listagem. As dependências de teste e2e voltam junto com o primeiro endpoint de domínio. O SDK e as variáveis de LLM/embeddings entram nas etapas de Embeddings e Chat.
