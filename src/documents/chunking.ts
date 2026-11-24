export interface ChunkOptions {
  maxCharacters: number;
  overlapCharacters: number;
}

const MIN_CHUNK_FILL_RATIO = 0.6;

export function chunkText(text: string, options: ChunkOptions): string[] {
  validateOptions(options);

  const normalized = text.trim();
  if (normalized.length === 0) {
    return [];
  }

  const { maxCharacters, overlapCharacters } = options;
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxCharacters, normalized.length);

    if (end < normalized.length) {
      const minEnd = start + Math.floor((end - start) * MIN_CHUNK_FILL_RATIO);
      end = findBreakPosition(normalized, end, minEnd);
    }

    const content = normalized.slice(start, end).trim();

    if (content.length > 0) {
      chunks.push(content);
    }

    if (end >= normalized.length) {
      break;
    }

    let nextStart = end - overlapCharacters;

    if (nextStart <= start) {
      nextStart = start + 1;
    }

    if (overlapCharacters > 0) {
      const fallbackStart = nextStart;

      while (nextStart > start && !/\s/.test(normalized[nextStart - 1])) {
        nextStart -= 1;
      }

      if (nextStart <= start) {
        nextStart = fallbackStart;
      }
    }

    while (nextStart < end && /\s/.test(normalized[nextStart])) {
      nextStart += 1;
    }

    start = nextStart;
  }

  return chunks;
}

function validateOptions(options: ChunkOptions): void {
  const { maxCharacters, overlapCharacters } = options;

  if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
    throw new RangeError('maxCharacters must be a positive integer.');
  }

  if (!Number.isInteger(overlapCharacters) || overlapCharacters < 0) {
    throw new RangeError('overlapCharacters must be a non-negative integer.');
  }

  if (overlapCharacters >= maxCharacters) {
    throw new RangeError(
      'overlapCharacters must be smaller than maxCharacters.',
    );
  }
}

function findBreakPosition(text: string, end: number, minEnd: number): number {
  for (let i = end; i > minEnd; i -= 1) {
    if (text[i] === '\n' && text[i + 1] === '\n') {
      return i;
    }
  }

  for (let i = end; i > minEnd; i -= 1) {
    if (isSentenceBoundary(text, i)) {
      return i;
    }
  }

  for (let i = end; i > minEnd; i -= 1) {
    if (/\s/.test(text[i - 1])) {
      return i;
    }
  }

  return end;
}

function isSentenceBoundary(text: string, index: number): boolean {
  const before = text[index - 1];
  const after = text[index];

  return (
    before !== undefined &&
    '.!?'.includes(before) &&
    (after === undefined || /\s/.test(after))
  );
}
