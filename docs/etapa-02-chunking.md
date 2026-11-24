# Etapa 2 — Chunking

- **Data:** 2026-11-24
- **Status:** concluída
- **Objetivo:** dividir o texto de um documento em trechos com tamanho e overlap configuráveis, de forma pura e testável.

## O que foi implementado

- `chunkText(text, { maxCharacters, overlapCharacters })` em `src/documents/chunking.ts`.
- Prioridade de corte: parágrafo → frase → palavra → corte exato.
- Overlap entre trechos consecutivos.
- Normalização de espaços nas bordas de cada chunk.
- Validação dos parâmetros: inteiros, `maxCharacters > 0`, `overlapCharacters >= 0` e menor que `maxCharacters`.
- 10 testes unitários cobrindo vazio, texto curto, limites, parágrafos, frases, palavras, corte exato, overlap e parâmetros inválidos.
- A função ainda **não** está integrada ao upload; isso acontece na Etapa 3.

## Estrutura adicionada

| Caminho | Responsabilidade |
|---|---|
| `src/documents/chunking.ts` | Função pura de chunking e validação de opções. |
| `src/documents/chunking.spec.ts` | Testes de comportamento e bordas. |

## Algoritmo

```text
texto → trim
enquanto start < tamanho:
  end = min(start + maxCharacters, tamanho)
  se não é o último trecho:
    procurar quebra entre start + 60% do chunk e end:
      parágrafo (\n\n) → frase (. ! ? + espaço) → espaço → nenhuma
  chunk = texto[start:end].trim()
  próximo start = end - overlapCharacters
  avançar espaços em branco no início do próximo chunk
```

O limite mínimo de preenchimento de 60% evita chunks muito curtos quando uma quebra de parágrafo aparece logo no início da janela. O overlap é aproximado: `trim` e o ajuste de espaços podem reduzir alguns caracteres.

Exemplo real com `maxCharacters: 120` e `overlapCharacters: 20`:

```json
[
  "O padrão Outbox consiste em armazenar um evento na mesma transação utilizada para persistir uma operação de negócio.",
  "operação de negócio. Posteriormente, um Publisher publica o evento em uma fila.",
  "evento em uma fila. Esse padrão garante consistência entre o banco e a mensageria."
]
```

Os finais `operação de negócio.` e `evento em uma fila.` aparecem no início do chunk seguinte, mostrando o overlap.

## Decisões

- **Corte por caracteres, não por tokens:** é mais simples e independente de tokenizer de provedor. O limite real de um modelo de embedding é em tokens; a integração futura pode converter ou trocar a unidade. Para o corpus inicial em português, caracteres são um proxy razoável.
- **Prioridade de fronteiras:** parágrafos preservam unidades de sentido; frases são o fallback; palavras evitam cortes no meio de termos; o corte exato garante que o algoritmo sempre termine e respeite o limite.
- **Overlap:** melhora a continuidade entre chunks, especialmente quando uma resposta cai na fronteira. O custo é texto duplicado e mais embeddings.
- **Função pura:** sem DI, banco ou HTTP. Isso permite testar todos os casos de borda sem mocks e reutilizar a função na ingestão.
- **Configuração explícita:** as opções são passadas pelo chamador. As variáveis de ambiente `CHUNK_SIZE` e `CHUNK_OVERLAP` entram na Etapa 3, quando o upload passar a usar a função.
- **Sem metadados de chunk ainda:** a função retorna apenas strings. Índice, `document_id` e vetor entram com a tabela `chunks` na próxima etapa.
- **Erros de programação com `RangeError`:** parâmetros inválidos não são erros de HTTP; são violações de contrato da função.

## Limitações

- O corte conta unidades de código UTF-16; emojis podem ser divididos ao meio. Para o corpus inicial em português, não é um problema prático.
- Quebras de parágrafo só são consideradas na última fração da janela; se um parágrafo termina antes, o chunk pode conter mais de um parágrafo.
- O overlap pode ser menor que o configurado em fronteiras, por causa do `trim` e da busca por espaço.
- Chunking é uma heurística: não entende semântica nem tópicos. Um chunk pode conter o final de um assunto e o início de outro.

## Verificação

- 26 testes unitários no total, sendo 10 novos de chunking.
- `npm run typecheck`, `npm run lint` e `npm run build` passando.
- Exemplo real gerado via `tsx`, com três chunks e overlap visível.
- `dist/documents/chunking.js` gerado; sem source maps, `.d.ts` ou cache incremental.
- Nenhuma alteração de banco nesta etapa.

## Conceitos praticados

- O que é um chunk e por que não embeddar o documento inteiro.
- Overlap e o trade-off entre continuidade e duplicação.
- Heurísticas de fronteira e a diferença entre “cabe no limite” e “faz sentido semanticamente”.
- Função pura, validação de contrato e testes de borda.
- A diferença entre caracteres e tokens no desenho de chunking.

## Fora do escopo

- Persistência de chunks.
- Embeddings.
- Integração com `POST /documents`.
- Variáveis de ambiente de chunking.
- Busca vetorial e chat.

## Ajuste posterior (Etapa 3)

Durante a integração real, o início do overlap passou a ser alinhado ao começo da palavra quando existe espaço na janela, evitando chunks começando no meio de um termo (`"zena um evento..."`). Um teste extra foi adicionado; a suíte de chunking passou a ter 11 testes.

## Próxima etapa

**Etapa 3 — Embeddings:** criar a tabela `chunks` com `document_id`, índice, conteúdo e vetor; integrar `chunkText` ao upload; gerar embeddings em lote; persistir documento e chunks de forma transacional.

Antes da Etapa 3 é preciso definir o provedor de embeddings: o DeepSeek não oferece esse endpoint. As opções são OpenAI, Voyage, Gemini ou um modelo local.
