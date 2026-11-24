import { describe, expect, it } from 'vitest';
import { chunkText } from './chunking.js';

const options = { maxCharacters: 100, overlapCharacters: 10 };

describe('chunkText', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    expect(chunkText('', options)).toEqual([]);
    expect(chunkText('  \n\t ', options)).toEqual([]);
  });

  it('returns a single trimmed chunk when the text fits', () => {
    expect(chunkText('  texto curto  ', options)).toEqual(['texto curto']);
  });

  it('does not split text exactly at the limit', () => {
    const text = 'a'.repeat(100);

    expect(chunkText(text, options)).toEqual([text]);
  });

  it('keeps every chunk within the maximum size', () => {
    const text = 'palavra '.repeat(50).trim();
    const chunks = chunkText(text, {
      maxCharacters: 50,
      overlapCharacters: 0,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it('prefers paragraph boundaries', () => {
    const text = 'Primeiro parágrafo.\n\nSegundo parágrafo.';
    const chunks = chunkText(text, {
      maxCharacters: 30,
      overlapCharacters: 0,
    });

    expect(chunks).toEqual(['Primeiro parágrafo.', 'Segundo parágrafo.']);
  });

  it('falls back to sentence boundaries', () => {
    const text = 'Frase um. Frase dois. Frase três.';
    const chunks = chunkText(text, {
      maxCharacters: 24,
      overlapCharacters: 0,
    });

    expect(chunks).toEqual(['Frase um. Frase dois.', 'Frase três.']);
  });

  it('falls back to word boundaries', () => {
    expect(
      chunkText('alfa beta gama delta', {
        maxCharacters: 12,
        overlapCharacters: 0,
      }),
    ).toEqual(['alfa beta', 'gama delta']);
  });

  it('hard-splits when there is no whitespace', () => {
    const text = '0123456789'.repeat(3);
    const chunks = chunkText(text, {
      maxCharacters: 10,
      overlapCharacters: 0,
    });

    expect(chunks).toEqual(['0123456789', '0123456789', '0123456789']);
  });

  it('overlaps consecutive chunks', () => {
    const text = '0123456789'.repeat(4);
    const chunks = chunkText(text, {
      maxCharacters: 20,
      overlapCharacters: 5,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[1].startsWith(chunks[0].slice(-5))).toBe(true);
    expect(chunks[2].startsWith(chunks[1].slice(-5))).toBe(true);
  });

  it('starts overlap chunks at word boundaries when possible', () => {
    const words = ['alfa', 'beta', 'gama', 'delta', 'epsilon', 'zeta'];
    const chunks = chunkText(words.join(' '), {
      maxCharacters: 12,
      overlapCharacters: 5,
    });

    for (const chunk of chunks) {
      expect(words.some((word) => chunk.startsWith(word))).toBe(true);
    }
  });

  it('validates maxCharacters and overlapCharacters', () => {
    expect(() =>
      chunkText('texto', { maxCharacters: 0, overlapCharacters: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      chunkText('texto', { maxCharacters: 10, overlapCharacters: -1 }),
    ).toThrow(RangeError);
    expect(() =>
      chunkText('texto', { maxCharacters: 10, overlapCharacters: 10 }),
    ).toThrow(RangeError);
    expect(() =>
      chunkText('texto', { maxCharacters: 10.5, overlapCharacters: 0 }),
    ).toThrow(RangeError);
  });
});
