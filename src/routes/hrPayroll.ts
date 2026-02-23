import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { requirePermission } from '../middleware/permissions.js'
import { DayType } from '@prisma/client'

const router = Router()

// Only admins or those with hr-calendar manage permission can do payroll
router.use(requirePermission('hr-calendar', 'edit'))

const payrollQuerySchema = z.object({
    employeeId: z.string(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Cálculo de la liquidación de salario
 */
async function calculatePayroll(tenantId: bigint, employeeId: string, startDateStr: string, endDateStr: string) {
    const startDate = new Date(startDateStr)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(endDateStr)
    endDate.setHours(23, 59, 59, 999)

    const employee = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
    })

    if (!employee) {
        throw new Error('Empleado no encontrado')
    }

    // Buscar todos los schedules en el rango que NO han sido pagados
    const schedules = await prisma.employeeSchedule.findMany({
        where: {
            tenantId,
            employeeId,
            date: {
                gte: startDate,
                lte: endDate,
            },
            paymentId: null, // Solo los no pagados
        },
        include: {
            advances: {
                where: { paymentId: null }
            }
        },
        orderBy: { date: 'asc' }
    })

    let totalDaysWorked = 0
    let totalOvertimeMinutes = 0
    let totalAdvancesAmount = 0

    const daysIncluded: Array<{ date: string, type: DayType, overtimeMinutes: number, advance: number }> = []

    for (const schedule of schedules) {
        let dayCount = 0
        // Lógica para contar los días a pagar.
        // Si es LABORAL con marca de entrada y salida, se cuenta como 1.
        // Si es FERIADO o AUSENTE justificado que se paga, se ajustaría aquí.
        if (schedule.dayType === DayType.LABORAL) {
            if (schedule.clockIn && schedule.clockOut) {
                dayCount = 1
            }
        } else if (schedule.dayType === DayType.FERIADO) {
            // Ejemplo: Feriado cuenta como trabajado si la empresa paga los feriados.
            // En este caso lo asuminos como 1 para salario fijo, pero requeriría ajuste según reglas de la empresa.
            // Para simplificar, si es feriado y marcó entrada, lo pagamos, sino no.
            if (schedule.clockIn && schedule.clockOut) {
                dayCount = 2 // Pago doble por feriado trabajado? Ajustable.
            } else {
                dayCount = 1 // Pago simple por ser feriado no trabajado.
            }
        } else if (schedule.dayType === DayType.NO_LABORAL) {
            // Ejemplo sabado medio día (si es que lo marcan como NO_LABORAL)
            if (schedule.clockIn && schedule.clockOut) {
                dayCount = 1
            }
        } else if (schedule.dayType === DayType.MEDIO_DIA) {
            // Medio día laboral
            if (schedule.clockIn || schedule.clockOut) {
                dayCount = 0.5
            }
        }

        totalDaysWorked += dayCount
        totalOvertimeMinutes += schedule.overtimeMinutes

        let dailyAdvance = 0
        for (const advance of schedule.advances) {
            dailyAdvance += Number(advance.amount)
        }
        totalAdvancesAmount += dailyAdvance

        daysIncluded.push({
            date: schedule.date.toISOString().split('T')[0],
            type: schedule.dayType,
            overtimeMinutes: schedule.overtimeMinutes,
            advance: dailyAdvance
        })
    }

    // Además, buscamos adelantos huerfanos (sin schedule) en ese rango que no han sido pagados
    const orphanAdvances = await prisma.employeeAdvance.findMany({
        where: {
            tenantId,
            employeeId,
            scheduleId: null,
            paymentId: null,
            issuedAt: {
                gte: startDate,
                lte: endDate
            }
        }
    })

    for (const advance of orphanAdvances) {
        totalAdvancesAmount += Number(advance.amount)
    }

    const baseSalary = Number(employee.salaryAmount) || 0
    let dailyRate = 0
    let hourlyRate = 0

    if (employee.salaryType === 'MONTHLY') {
        // Suponiendo 30 días laborables para cálculo mensual.
        dailyRate = baseSalary / 30
        hourlyRate = dailyRate / 8 // Asumiendo 8 horas por dia
    } else if (employee.salaryType === 'WEEKLY') {
        dailyRate = baseSalary / 6 // Asumiendo 6 días a la semana de trabajo
        hourlyRate = dailyRate / 8
    } else {
        // DAILY
        dailyRate = baseSalary
        hourlyRate = dailyRate / 8
    }

    const baseAmount = Math.round(totalDaysWorked * dailyRate)
    const totalOvertimeHours = totalOvertimeMinutes / 60

    // Asumiendo que las horas extras se pagan un 50% mas (1.5x)
    const overtimeRate = hourlyRate * 1.5
    const overtimeAmount = Math.round(totalOvertimeHours * overtimeRate)

    const totalAmount = baseAmount + overtimeAmount - totalAdvancesAmount

    return {
        employee: {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            salaryType: employee.salaryType,
            salaryAmount: baseSalary,
            dailyRate: Math.round(dailyRate),
            hourlyRate: Math.round(hourlyRate)
        },
        period: {
            startDate: startDateStr,
            endDate: endDateStr
        },
        daysIncluded,
        orphanAdvances: orphanAdvances.map(a => ({ id: a.id, amount: Number(a.amount), date: a.issuedAt.toISOString().split('T')[0] })),
        summary: {
            totalDaysWorked,
            totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
            baseAmount,
            overtimeAmount,
            advancesAmount: totalAdvancesAmount,
            totalAmount: Math.max(0, totalAmount) // Evitar totales negativos si adelantos son mayores
        },
        rawSchedules: schedules // Pasamos para poder actualizarlos luego
    }
}

// GET /hr/payroll/preview
router.get('/preview', async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const { employeeId, startDate, endDate } = payrollQuerySchema.parse(req.query)

        const calculation = await calculatePayroll(tenantId, employeeId, startDate, endDate)
        const { rawSchedules, ...preview } = calculation // Ocultamos rawSchedules
        res.json(preview)
    } catch (err) {
        next(err)
    }
})

// POST /hr/payroll/execute
router.post('/execute', async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const { employeeId, startDate, endDate } = payrollQuerySchema.parse(req.body)

        // Recalcular de forma segura del lado del servidor
        const calculation = await calculatePayroll(tenantId, employeeId, startDate, endDate)

        if (calculation.summary.totalDaysWorked === 0 && calculation.summary.totalOvertimeHours === 0 && calculation.summary.advancesAmount === 0) {
            return res.status(400).json({ error: 'No hay nada pendiente a pagar en este periodo.' })
        }

        // Usar transacción para consistencia
        const result = await prisma.$transaction(async (tx) => {
            // 1. Crear el registro de pago
            const payment = await tx.employeePayment.create({
                data: {
                    tenantId,
                    employeeId,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    totalDaysWorked: calculation.summary.totalDaysWorked,
                    totalOvertimeHours: calculation.summary.totalOvertimeHours,
                    baseAmount: calculation.summary.baseAmount,
                    overtimeAmount: calculation.summary.overtimeAmount,
                    advancesAmount: calculation.summary.advancesAmount,
                    totalAmount: calculation.summary.totalAmount,
                }
            })

            // 2. Marcar schedules como pagados
            const scheduleIds = calculation.rawSchedules.map(s => s.id)
            if (scheduleIds.length > 0) {
                await tx.employeeSchedule.updateMany({
                    where: {
                        id: { in: scheduleIds },
                        tenantId
                    },
                    data: {
                        paymentId: payment.id
                    }
                })
            }

            // 3. Marcar advances como pagados
            // Sumamos los vinculados a schedules + los huérfanos
            const advanceIds = calculation.rawSchedules.flatMap(s => s.advances.map(a => a.id))
            const orphanAdvanceIds = calculation.orphanAdvances.map(a => a.id)
            const allAdvanceIds = [...advanceIds, ...orphanAdvanceIds]

            if (allAdvanceIds.length > 0) {
                await tx.employeeAdvance.updateMany({
                    where: {
                        id: { in: allAdvanceIds },
                        tenantId
                    },
                    data: {
                        paymentId: payment.id
                    }
                })
            }

            return payment
        })

        res.json({ ok: true, payment: result })
    } catch (err) {
        next(err)
    }
})

// GET /hr/payroll/history/:employeeId
router.get('/history/:employeeId', async (req, res, next) => {
    try {
        const tenantId = getTenantId(res)
        const employeeId = req.params.employeeId

        const payments = await prisma.employeePayment.findMany({
            where: {
                tenantId,
                employeeId
            },
            orderBy: {
                paymentDate: 'desc'
            }
        })

        res.json(payments)
    } catch (err) {
        next(err)
    }
})

export default router
