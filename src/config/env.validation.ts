import Joi from 'joi';

const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  CHUNK_SIZE: Joi.number().integer().min(1).default(1200),
  CHUNK_OVERLAP: Joi.number()
    .integer()
    .min(0)
    .less(Joi.ref('CHUNK_SIZE'))
    .default(150),

  EMBEDDINGS_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://127.0.0.1:11434/v1'),
  EMBEDDINGS_MODEL: Joi.string().default('bge-m3'),
  EMBEDDINGS_DIMENSION: Joi.number().integer().min(1).default(1024),
  EMBEDDINGS_BATCH_SIZE: Joi.number().integer().min(1).default(16),
  EMBEDDINGS_TIMEOUT_MS: Joi.number().integer().min(1000).default(60_000),
  EMBEDDINGS_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(0),

  RETRIEVAL_TOP_K: Joi.number().integer().min(1).max(50).default(5),
  RETRIEVAL_MIN_SCORE: Joi.number().min(-1).max(1).default(0.5),

  LLM_API_KEY: Joi.string().allow('').default(''),
  LLM_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('https://api.deepseek.com'),
  LLM_MODEL: Joi.string().default('deepseek-flash'),
  LLM_TIMEOUT_MS: Joi.number().integer().min(1000).default(60_000),
  LLM_MAX_RETRIES: Joi.number().integer().min(0).max(5).default(0),
  LLM_MAX_OUTPUT_TOKENS: Joi.number().integer().min(1).max(8192).default(1024),
  LLM_TEMPERATURE: Joi.number().min(0).max(2).default(0.1),
});

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  return value as Record<string, unknown>;
}
