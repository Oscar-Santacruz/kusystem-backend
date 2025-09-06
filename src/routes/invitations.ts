import { Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { getPrisma } from '../prisma'
import { getTenantId } from '../utils/tenant'
import { getCurrentUser } from '../utils/auth'
import { sendInvitationEmail } from '../lib/email'

export const invitationsRouter = Router()
export const publicInvitationsRouter = Router()
const prisma = getPrisma()

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})

// Crear invitación (privado, requiere tenant y permisos de admin/owner)
invitationsRouter.post('/', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    // Validar que el tenant exista
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) {
      return res.status(404).json({ error: 'Organization (tenant) not found' })
    }

    const { email, role } = createInvitationSchema.parse(req.body)

    // token seguro
    const token = crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).slice(2)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 días

    const user = await prisma.user.upsert({
      where: { authProviderId: cu.authProviderId ?? cu.id },
      update: {},
      create: {
        authProviderId: cu.authProviderId ?? cu.id,
        email: cu.email || `${(cu.authProviderId ?? cu.id).slice(0, 12)}@local` ,
        name: cu.name ?? null,
      },
    })

    // Validar permisos del usuario en la organización (owner/admin)
    const membership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId } },
    })
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to invite members to this organization' })
    }

    const inv = await prisma.invitation.create({
      data: {
        tenantId,
        email,
        role,
        token,
        expiresAt,
        createdByUserId: user.id,
      },
      include: { tenant: true },
    })

    const appUrl = process.env.PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 4001}`
    const inviteUrl = `${appUrl.replace(/\/$/, '')}/invitations/${inv.token}`

    await sendInvitationEmail(email, inv.tenant.name, inviteUrl)

    // Para facilitar pruebas (el token también viaja por email)
    res.status(201).json({ ok: true, id: inv.id, token: inv.token, inviteUrl })
  } catch (err) {
    next(err)
  }
})

// Obtener invitación por token (público)
publicInvitationsRouter.get('/:token', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(16) }).parse(req.params)
    const inv = await prisma.invitation.findUnique({ where: { token }, include: { tenant: true } })
    if (!inv) return res.status(404).json({ error: 'Invitation not found' })
    if (inv.acceptedAt) return res.status(400).json({ error: 'Invitation already accepted' })
    if (inv.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' })
    res.json({
      email: inv.email,
      role: inv.role,
      organization: { id: inv.tenantId.toString(), name: inv.tenant.name },
    })
  } catch (err) {
    next(err)
  }
})

// Aceptar invitación (público, pero requiere usuario autenticado en backend)
publicInvitationsRouter.post('/:token/accept', async (req, res, next) => {
  try {
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const { token } = z.object({ token: z.string().min(16) }).parse(req.params)
    const inv = await prisma.invitation.findUnique({ where: { token } })
    if (!inv) return res.status(404).json({ error: 'Invitation not found' })
    if (inv.acceptedAt) return res.status(400).json({ error: 'Invitation already accepted' })
    if (inv.expiresAt < new Date()) return res.status(400).json({ error: 'Invitation expired' })

    const user = await prisma.user.upsert({
      where: { authProviderId: cu.authProviderId ?? cu.id },
      update: { email: cu.email ?? undefined, name: cu.name ?? undefined },
      create: {
        authProviderId: cu.authProviderId ?? cu.id,
        email: cu.email || `${(cu.authProviderId ?? cu.id).slice(0, 12)}@local` ,
        name: cu.name ?? null,
      },
    })

    await prisma.$transaction(async (tx) => {
      await tx.membership.upsert({
        where: { userId_tenantId: { userId: user.id, tenantId: inv.tenantId } },
        update: { role: inv.role },
        create: { userId: user.id, tenantId: inv.tenantId, role: inv.role },
      })
      await tx.invitation.update({ where: { token }, data: { acceptedAt: new Date() } })
    })

    res.json({ ok: true, tenantId: inv.tenantId.toString() })
  } catch (err) {
    next(err)
  }
})
