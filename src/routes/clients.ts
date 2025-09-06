import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { clientSchema } from './schemas'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)
    const search = (req.query.search as string | undefined) ?? ''

    // Búsqueda avanzada: tokenización por espacios, AND entre tokens, OR por campo (name, taxId, phone, email)
    const tokens = (search || '')
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
    const where = tokens.length
      ? {
          AND: tokens.map((tok) => ({
            OR: [
              { name: { contains: tok, mode: 'insensitive' as const } },
              { taxId: { contains: tok, mode: 'insensitive' as const } },
              { phone: { contains: tok, mode: 'insensitive' as const } },
              { email: { contains: tok, mode: 'insensitive' as const } },
            ],
          })),
        }
      : {}

    const [data, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ])

    res.json({ data, total, page, pageSize })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const item = await prisma.client.findUniqueOrThrow({ where: { id } })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = clientSchema.parse(req.body)
    const created = await prisma.client.create({ data: input })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = clientSchema.partial().parse(req.body)
    const updated = await prisma.client.update({ where: { id }, data: input })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.client.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
