import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the database and pgvector version when healthy', async () => {
    const dataSource = {
      query: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ extversion: '0.8.0' }]),
    } as unknown as DataSource;

    const service = new HealthService(dataSource);

    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      pgvector: '0.8.0',
    });
  });

  it('throws 503 when the database query fails', async () => {
    const dataSource = {
      query: vi.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as DataSource;

    const service = new HealthService(dataSource);

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('throws 503 when the pgvector extension is missing', async () => {
    const dataSource = {
      query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    } as unknown as DataSource;

    const service = new HealthService(dataSource);

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
