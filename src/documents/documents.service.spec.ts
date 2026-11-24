import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { DocumentsService } from './documents.service.js';
import { Chunk } from './entities/chunk.entity.js';
import { Document } from './entities/document.entity.js';

function createFile(
  content: string,
  originalname = 'outbox.txt',
): Express.Multer.File {
  const buffer = Buffer.from(content, 'utf8');

  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'text/plain',
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

describe('DocumentsService', () => {
  let manager: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let repository: {
    manager: { transaction: ReturnType<typeof vi.fn> };
    find: ReturnType<typeof vi.fn>;
  };
  let embeddings: { embedDocuments: ReturnType<typeof vi.fn> };
  let service: DocumentsService;

  beforeEach(() => {
    manager = {
      create: vi.fn((_entity: unknown, input: Record<string, unknown>) => ({
        ...input,
      })),
      save: vi.fn(async (entity: unknown) => {
        if (Array.isArray(entity)) {
          return entity;
        }

        return {
          id: 'document-id',
          createdAt: new Date('2026-11-24T12:00:00Z'),
          ...(entity as Record<string, unknown>),
        };
      }),
    };

    repository = {
      manager: {
        transaction: vi.fn(
          async (callback: (m: typeof manager) => Promise<unknown>) =>
            callback(manager),
        ),
      },
      find: vi.fn(),
    };

    embeddings = {
      embedDocuments: vi.fn(async (texts: string[]) =>
        texts.map(() => [0.1, 0.2]),
      ),
    };

    const config = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'CHUNK_SIZE') return 20;
        if (key === 'CHUNK_OVERLAP') return 5;
        throw new Error(`Unexpected key: ${key}`);
      }),
    } as unknown as ConfigService;

    service = new DocumentsService(
      repository as unknown as Repository<Document>,
      embeddings as unknown as EmbeddingsService,
      config,
    );
  });

  it('chunks, embeds and stores the document with its chunks', async () => {
    const text = 'alfa beta gama delta epsilon zeta eta theta';
    const result = await service.ingest(createFile(text));

    const embeddedTexts = embeddings.embedDocuments.mock
      .calls[0][0] as string[];

    expect(embeddedTexts.length).toBeGreaterThan(1);
    expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
    expect(manager.create).toHaveBeenCalledWith(Document, {
      filename: 'outbox.txt',
      mimeType: 'text/plain',
      content: text,
    });
    expect(manager.create).toHaveBeenCalledWith(
      Chunk,
      expect.objectContaining({
        documentId: 'document-id',
        chunkIndex: 0,
        content: embeddedTexts[0],
        embedding: [0.1, 0.2],
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(expect.any(Array));
    expect(result.chunks).toBe(embeddedTexts.length);
    expect(result.id).toBe('document-id');
  });

  it('stores only the basename of the uploaded file', async () => {
    await service.ingest(createFile('texto', '../../etc/nota.md'));

    expect(manager.create).toHaveBeenCalledWith(
      Document,
      expect.objectContaining({ filename: 'nota.md' }),
    );
  });

  it('does not write to the database when embedding fails', async () => {
    embeddings.embedDocuments.mockRejectedValue(new Error('provider down'));

    await expect(service.ingest(createFile('texto'))).rejects.toThrow(
      'provider down',
    );
    expect(repository.manager.transaction).not.toHaveBeenCalled();
  });

  it('lists documents without their content', async () => {
    const createdAt = new Date('2026-11-24T12:00:00Z');
    repository.find.mockResolvedValue([
      { id: 'a', filename: 'a.txt', mimeType: 'text/plain', createdAt },
    ]);

    const result = await service.findAll();

    expect(repository.find).toHaveBeenCalledWith({
      select: { id: true, filename: true, mimeType: true, createdAt: true },
      order: { createdAt: 'DESC' },
    });
    expect(result).toEqual([
      { id: 'a', filename: 'a.txt', mimeType: 'text/plain', createdAt },
    ]);
  });
});
