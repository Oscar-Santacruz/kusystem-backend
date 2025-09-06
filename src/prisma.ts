import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | undefined

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error', 'warn']
    })
  }
  return prisma
}

export type { Prisma } from '@prisma/client'
