import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()

// Necesita permiso de ver el calendario HR (o se podría crear uno específico hr-employees)
router.use(requirePermission('hr-calendar', 'view'))

const employeeSchema = z.object({
    firstName: z.string().min(1, 'El nombre es requerido'),
    lastName: z.string().min(1, 'El apellido es requerido'),
    email: z.string().email().or(z.literal('')).optional().nullable(),
    phone: z.string().or(z.literal('')).optional().nullable(),
    department: z.string().or(z.literal('')).optional().nullable(),
    salaryType: z.enum(['MONTHLY', 'WEEKLY', 'DAILY']).default('MONTHLY'),
    salaryAmount: z.number().min(0).optional().nullable(),
    defaultShiftEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
})

// GET /hr/employees
router.get('/', async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        // Listar todos los empleados, incluyendo inactivos
        const employees = await prisma.employee.findMany({
            where: { tenantId },
            orderBy: { firstName: 'asc' },
        })

        const result = employees.map(emp => ({
            ...emp,
            name: `${emp.firstName} ${emp.lastName}`,
            salaryAmount: emp.salaryAmount ? Number(emp.salaryAmount) : null,
        }))

        res.json(result)
    } catch (error) {
        next(error)
    }
})

// GET /hr/employees/:id
router.get('/:id', async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const { id } = req.params

        const employee = await prisma.employee.findUnique({
            where: { id, tenantId },
        })

        if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' })

        res.json({
            ...employee,
            salaryAmount: employee.salaryAmount ? Number(employee.salaryAmount) : null,
        })
    } catch (error) {
        next(error)
    }
})

// POST /hr/employees
router.post('/', requirePermission('hr-calendar', 'edit'), async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const data = employeeSchema.parse(req.body)

        let createdEmployee;
        await prisma.$transaction(async (tx) => {
            createdEmployee = await tx.employee.create({
                data: {
                    tenantId,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email || null,
                    phone: data.phone || null,
                    department: data.department || null,
                    salaryType: data.salaryType,
                    salaryAmount: data.salaryAmount,
                    defaultShiftEnd: data.defaultShiftEnd || null,
                    isActive: true,
                },
            })

            if (createdEmployee.salaryAmount !== null) {
                await tx.employeeSalaryHistory.create({
                    data: {
                        tenantId,
                        employeeId: createdEmployee.id,
                        salaryType: createdEmployee.salaryType,
                        salaryAmount: createdEmployee.salaryAmount,
                        effectiveFrom: new Date(),
                    }
                })
            }
        })

        res.json(createdEmployee)
    } catch (error) {
        next(error)
    }
})

// PUT /hr/employees/:id
router.put('/:id', requirePermission('hr-calendar', 'edit'), async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const { id } = req.params
        const data = employeeSchema.parse(req.body)

        const existing = await prisma.employee.findUnique({ where: { id, tenantId } })
        if (!existing) return res.status(404).json({ error: 'Empleado no encontrado' })

        let updatedEmployee;
        await prisma.$transaction(async (tx) => {
            updatedEmployee = await tx.employee.update({
                where: { id },
                data: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email || null,
                    phone: data.phone || null,
                    department: data.department || null,
                    salaryType: data.salaryType,
                    salaryAmount: data.salaryAmount,
                    defaultShiftEnd: data.defaultShiftEnd || null,
                },
            })

            // Registrar historial si el salario cambió
            if (
                (existing.salaryAmount === null && data.salaryAmount !== null) ||
                (existing.salaryAmount !== null && data.salaryAmount === null) ||
                (existing.salaryAmount !== null && data.salaryAmount !== null && Number(existing.salaryAmount) !== data.salaryAmount) ||
                existing.salaryType !== data.salaryType
            ) {
                // Cerrar el historial anterior
                const lastHistory = await tx.employeeSalaryHistory.findFirst({
                    where: { tenantId, employeeId: id, effectiveTo: null },
                    orderBy: { effectiveFrom: 'desc' },
                })

                if (lastHistory) {
                    await tx.employeeSalaryHistory.update({
                        where: { id: lastHistory.id },
                        data: { effectiveTo: new Date() }
                    })
                }

                if (data.salaryAmount !== null) {
                    await tx.employeeSalaryHistory.create({
                        data: {
                            tenantId,
                            employeeId: id,
                            salaryType: data.salaryType,
                            salaryAmount: data.salaryAmount!,
                            effectiveFrom: new Date(),
                        }
                    })
                }
            }
        })

        res.json(updatedEmployee)
    } catch (error) {
        next(error)
    }
})

// PUT /hr/employees/:id/toggle-status
router.put('/:id/toggle-status', requirePermission('hr-calendar', 'edit'), async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const { id } = req.params

        const existing = await prisma.employee.findUnique({ where: { id, tenantId } })
        if (!existing) return res.status(404).json({ error: 'Empleado no encontrado' })

        const updated = await prisma.employee.update({
            where: { id },
            data: { isActive: !existing.isActive },
        })

        res.json(updated)
    } catch (error) {
        next(error)
    }
})

export default router
