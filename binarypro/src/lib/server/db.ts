import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __binaryproPrisma: PrismaClient | undefined;
}

export const db: PrismaClient =
  globalThis.__binaryproPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalThis.__binaryproPrisma = db;

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
