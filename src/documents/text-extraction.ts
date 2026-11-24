import {
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { extname } from 'node:path';

export interface ExtractedText {
  text: string;
  mimeType: string;
}

const SUPPORTED_EXTENSIONS = new Map<string, string>([
  ['.txt', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
]);

export function extractText(file: Express.Multer.File): ExtractedText {
  const extension = extname(file.originalname).toLowerCase();
  const mimeType = SUPPORTED_EXTENSIONS.get(extension);

  if (!mimeType) {
    throw new UnsupportedMediaTypeException(
      'Unsupported file type. Use .txt, .md or .markdown.',
    );
  }

  if (file.size === 0 || file.buffer.length === 0) {
    throw new UnprocessableEntityException('The file is empty.');
  }

  let text: string;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw new UnprocessableEntityException('The file is not valid UTF-8 text.');
  }

  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();

  if (text.length === 0) {
    throw new UnprocessableEntityException('The document has no text content.');
  }

  return { text, mimeType };
}
