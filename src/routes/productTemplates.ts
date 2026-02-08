
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()

// Schema para ProductTemplate
const productTemplateSchema = z.object({
    name: z.string().min(1),
    attributes: z.record(z.any()), // Definición de campos (JSON)
})

router.use(requirePermission('products', 'view')) // Usamos permiso de productos por ahora

// Listar templates
router.get('/', async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const templates = await prisma.productTemplate.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        })
        res.json({ data: templates })
    } catch (err) {
        next(err)
    }
})

// Obtener un template
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params
        const tenantId = getTenantId(res)
        const template = await prisma.productTemplate.findFirstOrThrow({
            where: { id, tenantId },
        })
        res.json(template)
    } catch (err) {
        next(err)
    }
})

// Crear template
router.post('/', async (req, res, next) => {
    try {
        const input = productTemplateSchema.parse(req.body)
        const tenantId = getTenantId(res)
        const created = await prisma.productTemplate.create({
            data: { ...input, tenantId },
        })
        res.status(201).json(created)
    } catch (err) {
        next(err)
    }
})

// Actualizar template
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params
        const input = productTemplateSchema.partial().parse(req.body)
        const tenantId = getTenantId(res)
        const result = await prisma.productTemplate.updateMany({
            where: { id, tenantId },
            data: input,
        })
        if (result.count === 0) {
            return res.status(404).json({ error: 'Template no encontrado' })
        }
        const updated = await prisma.productTemplate.findFirstOrThrow({
            where: { id, tenantId },
        })
        res.json(updated)
    } catch (err) {
        next(err)
    }
})

// Eliminar template
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params
        const tenantId = getTenantId(res)
        // Verificar si hay productos usándolo
        const count = await prisma.product.count({
            where: { templateId: id, tenantId },
        })
        if (count > 0) {
            return res.status(400).json({ error: 'No se puede eliminar: hay productos usando este template' })
        }

        const result = await prisma.productTemplate.deleteMany({
            where: { id, tenantId },
        })
        if (result.count === 0) {
            return res.status(404).json({ error: 'Template no encontrado' })
        }
        res.json({ ok: true })
    } catch (err) {
        next(err)
    }
})

export default router
