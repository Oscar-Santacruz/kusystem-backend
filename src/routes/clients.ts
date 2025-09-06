import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { clientSchema } from './schemas'
import { getTenantId } from '../utils/tenant'

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
    const tenantId = getTenantId(res)
    const where = {
      tenantId: tenantId,
      ...(tokens.length
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
        : {}),
    }

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
    const tenantId = getTenantId(res)
    const item = await prisma.client.findFirstOrThrow({ where: { id, tenantId } })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = clientSchema.parse(req.body)
    const tenantId = getTenantId(res)
    const created = await prisma.client.create({ data: { ...input, tenantId } })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = clientSchema.partial().parse(req.body)
    const tenantId = getTenantId(res)
    const result = await prisma.client.updateMany({ where: { id, tenantId }, data: input })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    const updated = await prisma.client.findFirstOrThrow({ where: { id, tenantId } })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const result = await prisma.client.deleteMany({ where: { id, tenantId } })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
