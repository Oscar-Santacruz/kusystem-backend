import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { z } from 'zod'

const router = Router()

// Schema de validación para filtros
const analyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  tz: z.string().default('America/Asuncion'),
  bucket: z.enum(['day', 'week', 'month', 'year']).default('month'),
  status: z.string().optional(),
  client_id: z.string().uuid().optional(),
  top: z.coerce.number().int().positive().default(10),
})

/**
 * GET /analytics/quotes
 * Retorna analytics agregados de presupuestos
 */
router.get('/quotes', async (req, res) => {
  try {
    const tenantId = getTenantId(res)

    // Validar query params
    const filters = analyticsQuerySchema.parse(req.query)
    const { from, to, tz, bucket, status, client_id, top } = filters

    // Defaults de fechas si no se proporcionan
    const toDate = to ? new Date(to) : new Date()
    const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 días atrás

    // Construir filtros base
    const baseWhere: any = {
      tenantId,
      createdAt: {
        gte: fromDate,
        lt: toDate,
      },
    }

    if (status) {
      baseWhere.status = status
    }

    if (client_id) {
      baseWhere.customerId = client_id
    }

    // KPIs
    const [kpisResult, expiring, expired] = await Promise.all([
      prisma.quote.aggregate({
        where: baseWhere,
        _count: true,
        _sum: { total: true },
      }),
      // Vencen en próximos 7 días
      prisma.quote.count({
        where: {
          ...baseWhere,
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Ya vencidos
      prisma.quote.count({
        where: {
          ...baseWhere,
          dueDate: {
            lt: new Date(),
          },
          status: { not: 'APPROVED' },
        },
      }),
    ])

    const count = kpisResult._count || 0
    const amount_sum = Number(kpisResult._sum.total || 0)
    const avg_ticket = count > 0 ? amount_sum / count : 0

    // Hit rate (aprobados / totales)
    const approved = await prisma.quote.count({
      where: { ...baseWhere, status: 'APPROVED' },
    })
    const hit_rate = count > 0 ? approved / count : 0

    // Lead time mediano (creado → aprobado)
    // Nota: El schema actual no tiene columna approvedAt, retornamos 0 por ahora
    // TODO: Agregar columna approvedAt al schema si se necesita tracking de aprobación
    const lead_time_median_hours = 0

    // Por estado
    const byStatusResult = await prisma.quote.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
      _sum: { total: true },
      orderBy: { _count: { status: 'desc' } },
    })

    const by_status = byStatusResult.map((item) => ({
      status: item.status,
      count: item._count,
      amount_sum: Number(item._sum.total || 0),
    }))

    // Serie temporal
    // Nota: date_trunc requiere raw query en Prisma
    const bucketFormat = {
      day: 'day',
      week: 'week',
      month: 'month',
      year: 'year',
    }[bucket]

    // Construir query con condiciones dinámicas
    let timeQuery = `
      SELECT 
        date_trunc('${bucketFormat}', "createdAt" AT TIME ZONE '${tz}') AS bucket,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(total), 0) AS amount_sum
      FROM "Quote"
      WHERE "tenantId" = ${tenantId}
        AND "createdAt" >= '${fromDate.toISOString()}'
        AND "createdAt" < '${toDate.toISOString()}'
    `
    
    if (status) {
      timeQuery += ` AND status = '${status}'`
    }
    
    if (client_id) {
      timeQuery += ` AND "customerId" = '${client_id}'`
    }
    
    timeQuery += `
      GROUP BY 1
      ORDER BY 1
    `

    const byTimeResult = await prisma.$queryRawUnsafe<
      Array<{ bucket: Date; count: bigint; amount_sum: number | null }>
    >(timeQuery)

    const by_time = byTimeResult.map((item) => ({
      bucket: item.bucket.toISOString().split('T')[0],
      count: Number(item.count),
      amount_sum: Number(item.amount_sum || 0),
    }))

    // Top clientes por cantidad
    const topClientsByCountResult = await prisma.$queryRawUnsafe<
      Array<{ client_id: string; client_name: string; count: bigint; amount_sum: number | null }>
    >(`
      SELECT 
        q."customerId" AS client_id,
        q."customerName" AS client_name,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(q.total), 0) AS amount_sum
      FROM "Quote" q
      WHERE q."tenantId" = ${tenantId}
        AND q."createdAt" >= '${fromDate.toISOString()}'
        AND q."createdAt" < '${toDate.toISOString()}'
        AND q."customerId" IS NOT NULL
      GROUP BY 1, 2
      ORDER BY count DESC
      LIMIT ${top}
    `)

    const top_clients_by_count = topClientsByCountResult.map((item) => ({
      client_id: item.client_id,
      client_name: item.client_name,
      count: Number(item.count),
      amount_sum: Number(item.amount_sum || 0),
    }))

    // Top clientes por monto
    const topClientsByAmountResult = await prisma.$queryRawUnsafe<
      Array<{ client_id: string; client_name: string; count: bigint; amount_sum: number | null }>
    >(`
      SELECT 
        q."customerId" AS client_id,
        q."customerName" AS client_name,
        COUNT(*)::bigint AS count,
        COALESCE(SUM(q.total), 0) AS amount_sum
      FROM "Quote" q
      WHERE q."tenantId" = ${tenantId}
        AND q."createdAt" >= '${fromDate.toISOString()}'
        AND q."createdAt" < '${toDate.toISOString()}'
        AND q."customerId" IS NOT NULL
      GROUP BY 1, 2
      ORDER BY amount_sum DESC
      LIMIT ${top}
    `)

    const top_clients_by_amount = topClientsByAmountResult.map((item) => ({
      client_id: item.client_id,
      client_name: item.client_name,
      count: Number(item.count),
      amount_sum: Number(item.amount_sum || 0),
    }))

    // Funnel simple (basado en estados)
    const funnelStages = ['DRAFT', 'OPEN', 'APPROVED', 'INVOICED']
    const funnelCounts = await Promise.all(
      funnelStages.map((stage) =>
        prisma.quote.count({
          where: {
            tenantId,
            createdAt: { gte: fromDate, lt: toDate },
            status: stage,
          },
        })
      )
    )

    const funnel = funnelStages.map((stage, idx) => ({
      stage,
      count: funnelCounts[idx],
    }))

    // Respuesta
    const response = {
      range: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
        tz,
        bucket,
      },
      kpis: {
        count,
        amount_sum,
        avg_ticket,
        hit_rate,
        lead_time_median_hours,
        expiring_7d: expiring,
        expired,
      },
      by_status,
      by_time,
      top_clients_by_count,
      top_clients_by_amount,
      funnel,
      last_updated: new Date().toISOString(),
    }

    // ETag simple basado en timestamp
    const etag = `W/"${Date.now()}"`
    res.setHeader('ETag', etag)
    res.setHeader('Cache-Control', 'max-age=60')

    // Check If-None-Match
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end()
    }

    res.json(response)
  } catch (error) {
    console.error('Error en /analytics/quotes:', error)
    res.status(500).json({ error: 'Error al obtener analytics' })
  }
})

export default router
