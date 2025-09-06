import { Router } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { quoteSchema, quoteItemSchema, additionalChargeSchema } from './schemas'

const router = Router()

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

    const where = search
      ? { customerName: { contains: search, mode: 'insensitive' as const } }
      : {}

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
      const { items, additionalCharges, branch, ...rest } = q as any
      return {
        ...rest,
        branchName: rest.branchName ?? branch?.name ?? null,
        subtotal: q.subtotal == null ? null : Number(q.subtotal),
        taxTotal: q.taxTotal == null ? null : Number(q.taxTotal),
        discountTotal: q.discountTotal == null ? null : Number(q.discountTotal),
        total: q.total == null ? null : Number(q.total),
        items: items.map((it: any) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: it.discount == null ? null : Number(it.discount),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        })),
        additionalCharges: (additionalCharges ?? []).map((ch: any) => ({
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
    const q = await prisma.quote.findUniqueOrThrow({
      where: { id },
      include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
    })
    const { items, additionalCharges, branch, ...rest } = q as any
    res.json({
      ...rest,
      branchName: rest.branchName ?? branch?.name ?? null,
      subtotal: q.subtotal == null ? null : Number(q.subtotal),
      taxTotal: q.taxTotal == null ? null : Number(q.taxTotal),
      discountTotal: q.discountTotal == null ? null : Number(q.discountTotal),
      total: q.total == null ? null : Number(q.total),
      items: items.map((it: any) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        discount: it.discount == null ? null : Number(it.discount),
        taxRate: it.taxRate == null ? null : Number(it.taxRate),
      })),
      additionalCharges: (additionalCharges ?? []).map((ch: any) => ({
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
        items: {
          createMany: {
            data: input.items.map((it) => ({
              productId: it.productId ?? undefined,
              description: it.description,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discount: it.discount ?? undefined,
              taxRate: it.taxRate ?? undefined,
            })),
          },
        },
        additionalCharges: input.additionalCharges && input.additionalCharges.length > 0
          ? {
              createMany: {
                data: input.additionalCharges.map((ch) => ({
                  type: ch.type,
                  amount: ch.amount,
                })),
              },
            }
          : undefined,
      },
      include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
    })

    {
      const { items, additionalCharges, branch, ...rest } = created as any
      res.status(201).json({
        ...rest,
        branchName: rest.branchName ?? branch?.name ?? null,
        subtotal: created.subtotal == null ? null : Number(created.subtotal),
        taxTotal: created.taxTotal == null ? null : Number(created.taxTotal),
        discountTotal: created.discountTotal == null ? null : Number(created.discountTotal),
        total: created.total == null ? null : Number(created.total),
        items: items.map((it: any) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: it.discount == null ? null : Number(it.discount),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        })),
        additionalCharges: (additionalCharges ?? []).map((ch: any) => ({
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

    const result = await prisma.$transaction(async (tx) => {
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
        await tx.quoteItem.deleteMany({ where: { quoteId: id } })
        await tx.quoteItem.createMany({
          data: input.items.map((it) => ({
            quoteId: id,
            productId: it.productId ?? undefined,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discount: it.discount ?? undefined,
            taxRate: it.taxRate ?? undefined,
          })),
        })
      }

      if (input.additionalCharges) {
        await tx.quoteAdditionalCharge.deleteMany({ where: { quoteId: id } })
        if (input.additionalCharges.length > 0) {
          await tx.quoteAdditionalCharge.createMany({
            data: input.additionalCharges.map((ch) => ({
              quoteId: id,
              type: ch.type,
              amount: ch.amount,
            })),
          })
        }
      }

      const finalQuote = await tx.quote.findUniqueOrThrow({
        where: { id },
        include: { items: true, additionalCharges: true, branch: { select: { name: true } } },
      })
      return finalQuote
    })

    {
      const { items, additionalCharges, branch, ...rest } = result as any
      res.json({
        ...rest,
        branchName: rest.branchName ?? branch?.name ?? null,
        subtotal: result.subtotal == null ? null : Number(result.subtotal),
        taxTotal: result.taxTotal == null ? null : Number(result.taxTotal),
        discountTotal: result.discountTotal == null ? null : Number(result.discountTotal),
        total: result.total == null ? null : Number(result.total),
        items: items.map((it: any) => ({
          ...it,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: it.discount == null ? null : Number(it.discount),
          taxRate: it.taxRate == null ? null : Number(it.taxRate),
        })),
        additionalCharges: (additionalCharges ?? []).map((ch: any) => ({
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
    await prisma.quote.delete({ where: { id } })
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
    const updated = await prisma.quote.update({
      where: { id },
      data: { publicEnabled: body.enabled },
      select: { id: true, publicId: true, publicEnabled: true },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// Regenerar publicId (y habilitar)
router.post('/:id/public/regenerate', async (req, res, next) => {
  try {
    const { id } = req.params
    const newPublicId = randomUUID()
    const updated = await prisma.quote.update({
      where: { id },
      data: { publicId: newPublicId, publicEnabled: true },
      select: { id: true, publicId: true, publicEnabled: true },
    })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
