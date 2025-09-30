import { Router } from 'express'
import pkg from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { sanitizeQuote } from '../utils/sanitize.js'

const { Prisma } = pkg
const router = Router()

// GET /public/quotes/:publicId
router.get('/quotes/:publicId', async (req, res, next) => {
  try {
    const { publicId } = req.params
    const q = await prisma.quote.findFirstOrThrow({
      where: { publicId, publicEnabled: true },
      include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
    })

    const { branch, ...rest } = q as any
    const sanitized = sanitizeQuote({ ...rest, branch } as any)
    // Aseguramos branchName consolidado (persistido o por join)
    const branchName = (q as any).branchName ?? branch?.name ?? null
    res.json({ ...sanitized, branchName })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Public quote not found' })
    }
    if (err instanceof Prisma.NotFoundError) {
      return res.status(404).json({ error: 'Public quote not found' })
    }
    next(err)
  }
})

export default router
