import {
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { extractText } from './text-extraction.js';

function createFile(
  content: Buffer | string,
  originalname = 'document.txt',
): Express.Multer.File {
  const buffer = Buffer.isBuffer(content)
    ? content
    : Buffer.from(content, 'utf8');

  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'text/plain',
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

describe('extractText', () => {
  it('extracts and normalizes a .txt file', () => {
    const result = extractText(createFile('  linha 1\r\nlinha 2\r\n'));

    expect(result).toEqual({
      text: 'linha 1\nlinha 2',
      mimeType: 'text/plain',
    });
  });

  it('preserves Markdown and derives its MIME type', () => {
    const result = extractText(createFile('# Título\n\nTexto', 'nota.md'));

    expect(result.text).toBe('# Título\n\nTexto');
    expect(result.mimeType).toBe('text/markdown');
  });

  it('accepts .markdown and uppercase extensions', () => {
    expect(extractText(createFile('texto', 'NOTA.MARKDOWN')).mimeType).toBe(
      'text/markdown',
    );
    expect(extractText(createFile('texto', 'NOTA.TXT')).mimeType).toBe(
      'text/plain',
    );
  });

  it('removes a UTF-8 BOM', () => {
    const result = extractText(createFile('﻿conteúdo'));

    expect(result.text).toBe('conteúdo');
  });

  it('rejects unsupported file types', () => {
    expect(() => extractText(createFile('texto', 'arquivo.pdf'))).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('rejects empty and whitespace-only files', () => {
    expect(() => extractText(createFile(''))).toThrow(
      UnprocessableEntityException,
    );
    expect(() => extractText(createFile('  \n\t'))).toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejects invalid UTF-8', () => {
    expect(() => extractText(createFile(Buffer.from([0xc3, 0x28])))).toThrow(
      UnprocessableEntityException,
    );
  });
});
