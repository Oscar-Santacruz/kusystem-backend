import type { Request, Response, NextFunction } from 'express'
import { getPrisma } from '../prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { getCurrentUser } from '../utils/auth.js'

const prisma = getPrisma()
const prismaAny = prisma as any

export type PermissionIdentifier = `${string}:${string}`

type RequirePermissionOptions = {
  allowOwnerBypass?: boolean
}

export function requirePermission(resource: string, action: string, options: RequirePermissionOptions = {}) {
  const permissionKey: PermissionIdentifier = `${resource}:${action}`
  const allowOwnerBypass = options.allowOwnerBypass ?? true

  return async function permissionMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = getTenantId(res)
      const currentUser = getCurrentUser(req)
      if (!currentUser?.id && !currentUser?.authProviderId) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { id: currentUser.id },
            { authProviderId: currentUser.authProviderId ?? currentUser.id },
          ],
        },
      })

      if (!user) {
        return res.status(403).json({ error: 'User not registered' })
      }

      const membership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId,
          },
        },
      })

      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this organization' })
      }

      if (allowOwnerBypass && membership.role === 'owner') {
        return next()
      }

      const rolePermission = await prismaAny.rolePermission.findFirst({
        where: {
          tenantId,
          role: membership.role,
          permission: {
            resource,
            action,
          },
        },
      })

      if (!rolePermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: permissionKey,
        })
      }

      return next()
    } catch (error) {
      return next(error)
    }
  }
}
