import { Router } from 'express'
import { z } from 'zod'
import { getPrisma } from '../prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { getCurrentUser } from '../utils/auth.js'

const prisma = getPrisma()
const prismaAny = prisma as any
const router = Router()

type PermissionRow = { id: string; resource: string; action: string; description: string | null }
type RolePermissionRow = { id: string; role: string; permission?: { resource: string; action: string } | null }
type MembershipRow = { id: string; role: string; userId: string; user: { email: string | null; name: string | null }; tenantId: bigint }

async function assertOwnerOrAdmin(userAuthId: string, tenantId: bigint) {
  const user = await prisma.user.findUnique({ where: { authProviderId: userAuthId } })
  if (!user) return false
  const membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } })
  if (!membership) return false
  if (membership.role === 'owner') return true

  if (membership.role === 'admin') {
    const hasPerm = await prismaAny.rolePermission.findFirst({
      where: { tenantId, role: membership.role, permission: { resource: 'admin', action: 'manage-permissions' } },
      include: { permission: true },
    })
    return !!hasPerm
  }
  return false
}

router.get('/roles', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const authId = cu.authProviderId ?? cu.id
    const canManage = await assertOwnerOrAdmin(authId, tenantId)
    if (!canManage) return res.status(403).json({ error: 'Insufficient permissions' })

    const permissionsPromise = prismaAny.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    }) as Promise<PermissionRow[]>
    const rolePermissionsPromise = prismaAny.rolePermission.findMany({
      where: { tenantId },
      include: { permission: true },
    }) as Promise<RolePermissionRow[]>
    const membershipsPromise = prisma.membership.findMany({
      where: { tenantId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }) as Promise<MembershipRow[]>

    const [permissions, rolePermissions, memberships] = await Promise.all([
      permissionsPromise,
      rolePermissionsPromise,
      membershipsPromise,
    ])

    const grouped: Record<string, string[]> = {}
    for (const rp of rolePermissions) {
      const perm = rp.permission
      if (!perm) continue
      if (!grouped[rp.role]) {
        grouped[rp.role] = []
      }
      grouped[rp.role].push(`${perm.resource}:${perm.action}`)
    }

    res.json({
      permissions: permissions.map((p) => ({ id: p.id, resource: p.resource, action: p.action, description: p.description })),
      rolePermissions: grouped,
      members: memberships.map((m) => ({
        id: m.id,
        role: m.role,
        user: { id: m.userId, email: m.user?.email ?? null, name: m.user?.name ?? null },
      })),
    })
  } catch (err) {
    next(err)
  }
})

const updateRolePermissionsSchema = z.object({
  permissions: z.array(z.string().regex(/^[\w-]+:[\w-]+$/)).default([]),
})

router.patch('/roles/:role', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const authId = cu.authProviderId ?? cu.id
    const canManage = await assertOwnerOrAdmin(authId, tenantId)
    if (!canManage) return res.status(403).json({ error: 'Insufficient permissions' })

    const { role } = z.object({ role: z.string().min(2).max(30) }).parse(req.params)
    const { permissions } = updateRolePermissionsSchema.parse(req.body)

    if (role === 'owner') {
      return res.status(400).json({ error: 'Owner permissions cannot be modified' })
    }

    const tenantRolePermissions = await (prismaAny.rolePermission.findMany({
      where: { tenantId, role },
      include: { permission: true },
    }) as Promise<RolePermissionRow[]>)

    const incoming = new Set(permissions)
    const existing = new Set<string>()
    const toRemove: RolePermissionRow[] = []
    for (const rp of tenantRolePermissions) {
      const perm = rp.permission
      if (!perm) continue
      const key = `${perm.resource}:${perm.action}`
      if (!incoming.has(key)) {
        toRemove.push(rp)
      }
      existing.add(key)
    }

    const toAdd = [...incoming].filter((perm) => !existing.has(perm))

    await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await (tx as typeof prismaAny).rolePermission.deleteMany({ where: { id: { in: toRemove.map((rp) => rp.id) }, tenantId } })
      }

      if (toAdd.length > 0) {
        for (const perm of toAdd) {
          const [resource, action] = perm.split(':')
          const dbPerm = await (tx as typeof prismaAny).permission.findUnique({ where: { resource_action: { resource, action } } })
          if (!dbPerm) continue
          await (tx as typeof prismaAny).rolePermission.upsert({
            where: {
              tenantId_role_permissionId: {
                tenantId,
                role,
                permissionId: dbPerm.id,
              },
            },
            update: {},
            create: { tenantId, role, permissionId: dbPerm.id },
          })
        }
      }
    })

    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

const updateMembershipRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
})

router.patch('/memberships/:membershipId', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const authId = cu.authProviderId ?? cu.id
    const canManage = await assertOwnerOrAdmin(authId, tenantId)
    if (!canManage) return res.status(403).json({ error: 'Insufficient permissions' })

    const { membershipId } = z.object({ membershipId: z.string().min(1) }).parse(req.params)
    const { role } = updateMembershipRoleSchema.parse(req.body)

    const membership = await prisma.membership.findUnique({ where: { id: membershipId } })
    if (!membership || membership.tenantId !== tenantId) {
      return res.status(404).json({ error: 'Membership not found' })
    }

    if (membership.role === 'owner' && role !== 'owner') {
      const ownerCount = await prisma.membership.count({ where: { tenantId, role: 'owner' } })
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Debe quedar al menos un owner en la organización' })
      }
    }

    await prisma.membership.update({ where: { id: membershipId }, data: { role } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
