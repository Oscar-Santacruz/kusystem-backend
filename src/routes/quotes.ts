import { Router } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { Quote, QuoteItem, QuoteAdditionalCharge, PrismaClient } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { quoteSchema, quoteItemSchema, additionalChargeSchema } from './schemas.js'
import { getTenantId } from '../utils/tenant.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()

router.use(requirePermission('quotes', 'view'))

function computeTotals(
  items: z.infer<typeof quoteItemSchema>[],
  additionalCharges?: z.infer<typeof additionalChargeSchema>[],
) {
  const subtotal = items.reduce((a, it) => a + it.quantity * it.unitPrice, 0)
  const taxTotal = items.reduce((a, it) => a + (it.taxRate ? it.quantity * it.unitPrice * it.taxRate : 0), 0)
  const discountTotal = items.reduce((a, it) => a + (it.discount ?? 0), 0)
  const chargesTotal = (additionalCharges ?? []).reduce((a, ch) => a + ch.amount, 0)
  const total = subtotal + taxTotal - discountTotal + chargesTotal
  return { subtotal, taxTotal, discountTotal, total }
}

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)
    const search = (req.query.search as string | undefined) ?? ''

    const tenantId = getTenantId(res)
    const where = {
      tenantId,
      ...(search
        ? { customerName: { contains: search, mode: 'insensitive' as const } }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: true,
          additionalCharges: true,
          branch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quote.count({ where }),
    ])

            const data = rows.map((q) => {
      const { items, additionalCharges, branch, ...rest } = q;
      return {
        ...rest,
        branchName: rest.branchName ?? branch?.name ?? null,
        subtotal: q.subtotal == null ? null : Number(q.subtotal),
        taxTotal: q.taxTotal == null ? null : Number(q.taxTotal),
        discountTotal: q.discountTotal == null ? null : Number(q.discountTotal),
        total: q.total == null ? null : Number(q.total),
        items: items.map((it: QuoteItem) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: it.discount == null ? null : Number(it.discount),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        })),
        additionalCharges: (additionalCharges ?? []).map((ch: QuoteAdditionalCharge) => ({
          ...ch,
          amount: Number(ch.amount),
        })),
      }
    })

    res.json({ data, total, page, pageSize })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const q = await prisma.quote.findFirstOrThrow({
      where: { id, tenantId },
      include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
    })
            const { items, additionalCharges, branch, ...rest } = q;
    res.json({
      ...rest,
      branchName: rest.branchName ?? branch?.name ?? null,
      subtotal: q.subtotal == null ? null : Number(q.subtotal),
      taxTotal: q.taxTotal == null ? null : Number(q.taxTotal),
      discountTotal: q.discountTotal == null ? null : Number(q.discountTotal),
      total: q.total == null ? null : Number(q.total),
      items: items.map((it: QuoteItem) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: it.discount == null ? null : Number(it.discount),
        taxRate: it.taxRate == null ? null : Number(it.taxRate),
      })),
      additionalCharges: (additionalCharges ?? []).map((ch: QuoteAdditionalCharge) => ({
        ...ch,
        amount: Number(ch.amount),
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const input = quoteSchema.parse(req.body)
    const totals = computeTotals(input.items, input.additionalCharges)
    const tenantId = getTenantId(res)

    const created = await prisma.quote.create({
      data: {
        status: input.status ?? undefined,
        customerId: input.customerId ?? undefined,
        customerName: input.customerName,
        branchId: input.branchId ?? undefined,
        branchName: input.branchName ?? undefined,
        issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        currency: input.currency ?? undefined,
        notes: input.notes ?? undefined,
        printNotes: input.printNotes ?? undefined,
        publicId: randomUUID(),
        publicEnabled: true,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        tenantId,
        items: {
          createMany: {
            data: input.items.map((it) => ({
              productId: it.productId ?? undefined,
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount ?? undefined,
              taxRate: it.taxRate ?? undefined,
              tenantId,
            })),
          },
        },
        additionalCharges: input.additionalCharges && input.additionalCharges.length > 0
          ? {
              createMany: {
                data: input.additionalCharges.map((ch) => ({
                  type: ch.type,
                  amount: ch.amount,
                  tenantId,
                })),
              },
            }
          : undefined,
      },
      include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
    })

        {
      const { items, additionalCharges, branch, ...rest } = created;
      res.status(201).json({
        ...rest,
        branchName: rest.branchName ?? branch?.name ?? null,
        subtotal: created.subtotal == null ? null : Number(created.subtotal),
        taxTotal: created.taxTotal == null ? null : Number(created.taxTotal),
        discountTotal: created.discountTotal == null ? null : Number(created.discountTotal),
        total: created.total == null ? null : Number(created.total),
        items: items.map((it: QuoteItem) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: it.discount == null ? null : Number(it.discount),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        })),
        additionalCharges: (additionalCharges ?? []).map((ch: QuoteAdditionalCharge) => ({
          ...ch,
          amount: Number(ch.amount),
        })),
      })
    }
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = quoteSchema.partial().parse(req.body)
    const tenantId = getTenantId(res)

    const result = await prisma.$transaction(async (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => {
      const existing = await tx.quote.findFirst({ where: { id, tenantId } })
      if (!existing) {
        throw Object.assign(new Error('Presupuesto no encontrado'), { status: 404 })
      }
      const totals = input.items || input.additionalCharges
        ? computeTotals(input.items ?? [], input.additionalCharges ?? [])
        : undefined

      const updated = await tx.quote.update({
        where: { id },
        data: {
          status: input.status ?? undefined,
          customerId: input.customerId ?? undefined,
          customerName: input.customerName ?? undefined,
          branchId: input.branchId ?? undefined,
          branchName: input.branchName ?? undefined,
          issueDate: input.issueDate ? new Date(input.issueDate) : undefined,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          currency: input.currency ?? undefined,
          notes: input.notes ?? undefined,
          printNotes: input.printNotes ?? undefined,
          subtotal: totals?.subtotal,
          taxTotal: totals?.taxTotal,
          discountTotal: totals?.discountTotal,
          total: totals?.total,
        },
        include: { items: true },
      })

      if (input.items) {
        await tx.quoteItem.deleteMany({ where: { quoteId: id, tenantId } })
        await tx.quoteItem.createMany({
          data: input.items.map((it) => ({
            quoteId: id,
            productId: it.productId ?? undefined,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount ?? undefined,
            taxRate: it.taxRate ?? undefined,
            tenantId,
          })),
        })
      }

      if (input.additionalCharges) {
        await tx.quoteAdditionalCharge.deleteMany({ where: { quoteId: id, tenantId } })
        if (input.additionalCharges.length > 0) {
          await tx.quoteAdditionalCharge.createMany({
            data: input.additionalCharges.map((ch) => ({
              quoteId: id,
              type: ch.type,
              amount: ch.amount,
              tenantId,
            })),
          })
        }
      }

      const finalQuote = await tx.quote.findFirstOrThrow({
        where: { id, tenantId },
        include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
      })
      return finalQuote
    })

        {
      const { items, additionalCharges, branch, ...rest } = result;
      res.json({
        ...rest,
        branchName: rest.branchName ?? branch?.name ?? null,
        subtotal: result.subtotal == null ? null : Number(result.subtotal),
        taxTotal: result.taxTotal == null ? null : Number(result.taxTotal),
        discountTotal: result.discountTotal == null ? null : Number(result.discountTotal),
        total: result.total == null ? null : Number(result.total),
        items: items.map((it: QuoteItem) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: it.discount == null ? null : Number(it.discount),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        })),
        additionalCharges: (additionalCharges ?? []).map((ch: QuoteAdditionalCharge) => ({
          ...ch,
          amount: Number(ch.amount),
        })),
      })
    }
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const result = await prisma.quote.deleteMany({ where: { id, tenantId } })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// Habilitar/deshabilitar enlace público
router.post('/:id/public/enable', async (req, res, next) => {
  try {
    const { id } = req.params
    const body = z.object({ enabled: z.boolean() }).parse(req.body)
    const tenantId = getTenantId(res)
    const updated = await prisma.quote.updateMany({
      where: { id, tenantId },
      data: { publicEnabled: body.enabled },
    })
    if (updated.count === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' })
    }
    const refreshed = await prisma.quote.findFirstOrThrow({ where: { id, tenantId }, select: { id: true, publicId: true, publicEnabled: true } })
    res.json(refreshed)
  } catch (err) {
    next(err)
  }
})

// Regenerar enlace público
router.post('/:id/regenerate-public-link', async (req, res, next) => {
  try {
    const { id } = req.params
    const newPublicId = randomUUID()
    const tenantId = getTenantId(res)
    const updated = await prisma.quote.updateMany({
      where: { id, tenantId },
      data: { publicId: newPublicId, publicEnabled: true },
    })
    if (updated.count === 0) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' })
    }
    const refreshed = await prisma.quote.findFirstOrThrow({ where: { id, tenantId }, select: { id: true, publicId: true, publicEnabled: true } })
    res.json(refreshed)
  } catch (err) {
    next(err)
  }
})

// PATCH /quotes/:id/status - Cambiar estado del presupuesto
const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'OPEN', 'APPROVED', 'REJECTED', 'EXPIRED', 'INVOICED']),
  reason: z.string().optional(),
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const { status, reason } = updateStatusSchema.parse(req.body)

    // Obtener usuario actual
    const changedBy = (req.headers['x-user-email'] as string) || (req.headers['x-user-name'] as string) || 'Sistema'

    // Obtener presupuesto actual
    const currentQuote = await prisma.quote.findFirst({
      where: { id, tenantId },
      select: { status: true },
    })

    if (!currentQuote) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' })
    }

    // Actualizar estado y crear historial en una transacción
    const [updatedQuote] = await prisma.$transaction([
      prisma.quote.update({
        where: { id },
        data: { status },
        include: {
          items: true,
          additionalCharges: true,
          branch: { select: { name: true } },
        },
      }),
      prisma.quoteStatusHistory.create({
        data: {
          quoteId: id,
          fromStatus: currentQuote.status,
          toStatus: status,
          reason: reason || null,
          changedBy,
          tenantId,
        },
      }),
    ])

    res.json(updatedQuote)
  } catch (err) {
    next(err)
  }
})

export default router
