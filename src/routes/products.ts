import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { productSchema } from './schemas'
import { getTenantId } from '../utils/tenant'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)
    const search = (req.query.search as string | undefined) ?? ''

    // Búsqueda avanzada: tokenización por espacios, AND entre tokens, OR por campo (name, sku, unit)
    const tokens = (search || '')
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean)
    const tenantId = getTenantId(res)
    const where = {
      tenantId: tenantId,
      ...(tokens.length
        ? {
            AND: tokens.map(tok => ({
              OR: [
                { name: { contains: tok, mode: 'insensitive' as const } },
                { sku: { contains: tok, mode: 'insensitive' as const } },
                { unit: { contains: tok, mode: 'insensitive' as const } },
              ],
            })),
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ])

    const data = rows.map((p) => ({
      ...p,
      price: Number(p.price),
      taxRate: p.taxRate == null ? null : Number(p.taxRate),
      // priceIncludesTax ya es boolean en Prisma
    }))

    res.json({ data, total, page, pageSize })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const p = await prisma.product.findFirstOrThrow({ where: { id, tenantId } })
    res.json({ ...p, price: Number(p.price), taxRate: p.taxRate == null ? null : Number(p.taxRate) })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = productSchema.parse(req.body)
    const tenantId = getTenantId(res)
    const created = await prisma.product.create({ data: { ...input, tenantId } })
    res.status(201).json({ ...created, price: Number(created.price), taxRate: created.taxRate == null ? null : Number(created.taxRate) })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = productSchema.partial().parse(req.body)
    const tenantId = getTenantId(res)
    const result = await prisma.product.updateMany({ where: { id, tenantId }, data: input })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    const updated = await prisma.product.findFirstOrThrow({ where: { id, tenantId } })
    res.json({ ...updated, price: Number(updated.price), taxRate: updated.taxRate == null ? null : Number(updated.taxRate) })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const result = await prisma.product.deleteMany({ where: { id, tenantId } })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
