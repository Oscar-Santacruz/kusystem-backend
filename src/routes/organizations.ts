import { Router } from 'express'
import { z } from 'zod'
import { getPrisma } from '../prisma'
import { getCurrentUser } from '../utils/auth'

const router = Router()
const prisma = getPrisma()

const createOrgSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  // El frontend enviará la KEY del storage en el campo logoUrl (p. ej. "kusystem/mi-org/logo.png")
  // Por eso no validamos como URL, solo que sea string razonable si viene.
  logoUrl: z.string().min(3).optional().nullable(),
})

// Crea organización (Tenant) y membresía owner
router.post('/', async (req, res, next) => {
  try {
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const { name, slug, logoUrl } = createOrgSchema.parse(req.body)

    // Asegurar usuario local
    const user = await prisma.user.upsert({
      where: { authProviderId: cu.authProviderId ?? cu.id },
      update: { email: cu.email ?? undefined, name: cu.name ?? undefined },
      create: {
        authProviderId: cu.authProviderId ?? cu.id,
        email: cu.email || `${(cu.authProviderId ?? cu.id).slice(0, 12)}@local` ,
        name: cu.name ?? null,
      },
    })

    const org = await prisma.tenant.create({
      data: {
        name,
        slug,
        logoUrl,
        createdByUserId: user.id,
        memberships: {
          create: {
            userId: user.id,
            role: 'owner',
          },
        },
      },
    })

    res.status(201).json(org)
  } catch (err) {
    next(err)
  }
})

// Mis organizaciones
router.get('/me', async (req, res, next) => {
  try {
    const cu = getCurrentUser(req)
    if (!cu?.authProviderId && !cu?.id) return res.status(401).json({ error: 'Unauthorized' })

    const user = await prisma.user.findUnique({ where: { authProviderId: cu.authProviderId ?? cu.id } })
    if (!user) return res.json({ data: [] })

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({ data: memberships })
  } catch (err) {
    next(err)
  }
})

export default router
