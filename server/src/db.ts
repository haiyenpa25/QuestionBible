import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function formatBibleReference(input: {
  book?: { nameVi: string } | null;
  chapter?: number | null;
  verseFrom?: number | null;
  verseTo?: number | null;
}): string | null {
  if (!input.book?.nameVi) return null;
  if (!input.chapter) return input.book.nameVi;
  if (!input.verseFrom) return `${input.book.nameVi} ${input.chapter}`;
  if (input.verseTo && input.verseTo > input.verseFrom) {
    return `${input.book.nameVi} ${input.chapter}:${input.verseFrom}-${input.verseTo}`;
  }
  return `${input.book.nameVi} ${input.chapter}:${input.verseFrom}`;
}

