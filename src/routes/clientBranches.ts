import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { branchSchema } from './schemas'
import { getTenantId } from '../utils/tenant'

export const clientBranchesByClient = Router({ mergeParams: true })
export const clientBranchesRouter = Router()

clientBranchesByClient.get('/:clientId/branches', async (req, res, next) => {
  try {
    const { clientId } = req.params
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)
    const tenantId = getTenantId(res)

    const [data, total] = await Promise.all([
      prisma.clientBranch.findMany({
        where: { clientId, tenantId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clientBranch.count({ where: { clientId, tenantId } }),
    ])

    res.json({ data, total, page, pageSize })
  } catch (err) {
    next(err)
  }
})

clientBranchesByClient.post('/:clientId/branches', async (req, res, next) => {
  try {
    const { clientId } = req.params
    const input = branchSchema.parse(req.body)
    const tenantId = getTenantId(res)
    const created = await prisma.clientBranch.create({ data: { ...input, clientId, tenantId } })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

clientBranchesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const item = await prisma.clientBranch.findFirstOrThrow({ where: { id, tenantId } })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

clientBranchesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = branchSchema.partial().parse(req.body)
    const tenantId = getTenantId(res)
    const result = await prisma.clientBranch.updateMany({ where: { id, tenantId }, data: input })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' })
    }
    const updated = await prisma.clientBranch.findFirstOrThrow({ where: { id, tenantId } })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

clientBranchesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenantId = getTenantId(res)
    const result = await prisma.clientBranch.deleteMany({ where: { id, tenantId } })
    if (result.count === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' })
    }
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
