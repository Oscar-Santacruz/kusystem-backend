import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { branchSchema } from './schemas'

export const clientBranchesByClient = Router({ mergeParams: true })
export const clientBranchesRouter = Router()

clientBranchesByClient.get('/:clientId/branches', async (req, res, next) => {
  try {
    const { clientId } = req.params
    const page = Number(req.query.page ?? 1)
    const pageSize = Number(req.query.pageSize ?? 20)

    const [data, total] = await Promise.all([
      prisma.clientBranch.findMany({
        where: { clientId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clientBranch.count({ where: { clientId } }),
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
    const created = await prisma.clientBranch.create({ data: { ...input, clientId } })
    res.status(201).json(created)
  } catch (err) {
    next(err)
  }
})

clientBranchesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const item = await prisma.clientBranch.findUniqueOrThrow({ where: { id } })
    res.json(item)
  } catch (err) {
    next(err)
  }
})

clientBranchesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const input = branchSchema.partial().parse(req.body)
    const updated = await prisma.clientBranch.update({ where: { id }, data: input })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

clientBranchesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.clientBranch.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
