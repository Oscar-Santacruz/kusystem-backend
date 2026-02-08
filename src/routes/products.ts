import { Router } from 'express'
import { Product } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { productSchema } from './schemas.js'
import { getTenantId } from '../utils/tenant.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()

router.use(requirePermission('products', 'view'))

// Endpoint específico para obtener/crear el producto genérico
router.get('/generic', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const SKU = 'CUSTOM-ITEM-001'

    let product = await prisma.product.findFirst({
      where: { tenantId, sku: SKU },
    })

    if (!product) {
      // Crear si no existe
      product = await prisma.product.create({
        data: {
          tenantId,
          sku: SKU,
          name: 'Servicio/Producto Personalizado',
          description: 'Producto genérico para items personalizados en presupuestos.',
          unit: 'UN',
          price: 0,
          cost: 0,
          taxRate: 0.1,
          priceIncludesTax: false,
          stock: null,
          minStock: null,
        },
      })
    }

    res.json({
      ...product,
      price: Number(product.price),
      cost: product.cost == null ? null : Number(product.cost),
      taxRate: product.taxRate == null ? null : Number(product.taxRate),
      stock: product.stock == null ? null : Number(product.stock),
      minStock: product.minStock == null ? null : Number(product.minStock),
    })
  } catch (err) {
    next(err)
  }
})

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

    const data = rows.map((p: Product) => ({
      ...p,
      price: Number(p.price),
      cost: p.cost == null ? null : Number(p.cost),
      taxRate: p.taxRate == null ? null : Number(p.taxRate),
      stock: p.stock == null ? null : Number(p.stock),
      minStock: p.minStock == null ? null : Number(p.minStock),
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
    res.json({
      ...p,
      price: Number(p.price),
      cost: p.cost == null ? null : Number(p.cost),
      taxRate: p.taxRate == null ? null : Number(p.taxRate),
      stock: p.stock == null ? null : Number(p.stock),
      minStock: p.minStock == null ? null : Number(p.minStock)
    })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = productSchema.parse(req.body)
    const tenantId = getTenantId(res)
    const created = await prisma.product.create({ data: { ...input, tenantId } as any })
    res.status(201).json({
      ...created,
      price: Number(created.price),
      cost: created.cost == null ? null : Number(created.cost),
      taxRate: created.taxRate == null ? null : Number(created.taxRate),
      stock: created.stock == null ? null : Number(created.stock),
      minStock: created.minStock == null ? null : Number(created.minStock)
    })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = productSchema.partial().parse(req.body)
    const tenantId = getTenantId(res)
    const result = await prisma.product.updateMany({ where: { id, tenantId }, data: input as any })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' })
    }
    const updated = await prisma.product.findFirstOrThrow({ where: { id, tenantId } })
    res.json({
      ...updated,
      price: Number(updated.price),
      cost: updated.cost == null ? null : Number(updated.cost),
      taxRate: updated.taxRate == null ? null : Number(updated.taxRate),
      stock: updated.stock == null ? null : Number(updated.stock),
      minStock: updated.minStock == null ? null : Number(updated.minStock)
    })
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
