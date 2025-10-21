import { Router } from 'express'
import { z } from 'zod'
import { Membership, User } from '@prisma/client'
import { getPrisma } from '../prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { getCurrentUser } from '../utils/auth.js'

const prisma = getPrisma()
const prismaAny = prisma as any
const router = Router()

async function assertAdminOrOwner(userAuthId: string, tenantId: bigint) {
  const user = await prisma.user.findUnique({ where: { authProviderId: userAuthId } })
  if (!user) return false
  const m = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } })
  return !!m && (m.role === 'owner' || m.role === 'admin')
}

// Lista miembros del tenant actual
router.get('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    // Debe ser miembro para ver (owner/admin/member). Si quieres, restringe a admin/owner
    const user = await prisma.user.findUnique({ where: { authProviderId: cu.authProviderId ?? cu.id } })
    if (!user) return res.status(403).json({ error: 'Not a member' })
    const membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } })
    if (!membership) return res.status(403).json({ error: 'Not a member' })

    const members = await prisma.membership.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })
    res.json({ data: members.map((m: Membership & { user: User }) => ({
      id: m.id,
      role: m.role,
      user: { id: m.userId, email: m.user.email, name: m.user.name },
      tenantId: m.tenantId.toString(),
    })) })
  } catch (err) { next(err) }
})

router.get('/me/permissions', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: cu.id },
          { authProviderId: cu.authProviderId ?? cu.id },
        ],
      },
    })
    if (!user) return res.status(403).json({ error: 'User not registered' })

    const membership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    })
    if (!membership) return res.status(403).json({ error: 'Not a member' })

    if (membership.role === 'owner') {
      const allPermissions = await prismaAny.permission.findMany()
      const permissions = allPermissions.map((p: { resource: string; action: string }) => `${p.resource}:${p.action}`)
      return res.json({ role: membership.role, permissions })
    }

    const rolePermissions = await prismaAny.rolePermission.findMany({
      where: { tenantId, role: membership.role },
      include: { permission: true },
    })

    type PermissionShape = { resource: string; action: string }

    const permissions = rolePermissions
      .map((rp: { permission?: PermissionShape | null }) => rp.permission)
      .filter((perm: PermissionShape | null | undefined): perm is PermissionShape => Boolean(perm))
      .map((perm: PermissionShape) => `${perm.resource}:${perm.action}`)

    return res.json({ role: membership.role, permissions })
  } catch (err) { next(err) }
})

// Eliminar miembro del tenant (owner/admin). No permite eliminarse si es el último owner.
router.delete('/:userId', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const ok = await assertAdminOrOwner(cu.authProviderId ?? cu.id, tenantId)
    if (!ok) return res.status(403).json({ error: 'Insufficient permissions' })

    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.params)

    // Evitar dejar sin owners
    const owners = await prisma.membership.count({ where: { tenantId, role: 'owner' } })
    const removing = await prisma.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } })
    if (!removing) return res.status(404).json({ error: 'Membership not found' })
    if (removing.role === 'owner' && owners <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last owner of the organization' })
    }

    await prisma.membership.delete({ where: { userId_tenantId: { userId, tenantId } } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
