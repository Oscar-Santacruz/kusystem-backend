import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { DayType } from '@prisma/client'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()

router.use(requirePermission('hr-calendar', 'view'))

// Schema para validar el upsert de schedule
const scheduleUpsertSchema = z.object({
  clockIn: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  clockOut: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  dayType: z.enum(['LABORAL', 'AUSENTE', 'LIBRE', 'NO_LABORAL', 'FERIADO']),
  overtimeMinutes: z.number().int().min(0).optional().default(0),
  advanceAmount: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /hr/calendar/week?start=YYYY-MM-DD
// Retorna empleados + horarios + adelantos de la semana
router.get('/week', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const startParam = req.query.start as string | undefined
    
    if (!startParam) {
      return res.status(400).json({ error: 'Parámetro "start" requerido (YYYY-MM-DD)' })
    }

    const startDate = new Date(startParam)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 6) // Lunes a Domingo

    // Obtener empleados
    const employees = await prisma.employee.findMany({
      where: { tenantId },
      orderBy: { firstName: 'asc' },
    })

    // Obtener horarios de la semana
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        advances: true,
      },
    })

    // Agrupar schedules por empleado
    const employeesWithSchedules = employees.map((emp) => {
      const empSchedules = schedules.filter((s) => s.employeeId === emp.id)
      
      // Calcular métricas semanales
      const weeklyOvertimeMinutes = empSchedules.reduce((sum, s) => sum + s.overtimeMinutes, 0)
      const weeklyAdvances = empSchedules.reduce((sum, s) => sum + s.advances.length, 0)
      const weeklyAdvancesAmount = empSchedules.reduce(
        (sum, s) => sum + s.advances.reduce((a, adv) => a + Number(adv.amount), 0),
        0
      )

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        phone: emp.phone,
        avatarUrl: emp.avatarUrl,
        monthlySalary: emp.monthlySalary ? Number(emp.monthlySalary) : null,
        defaultShiftStart: emp.defaultShiftStart,
        defaultShiftEnd: emp.defaultShiftEnd,
        weeklyOvertimeHours: Math.round(weeklyOvertimeMinutes / 60 * 10) / 10,
        weeklyAdvances,
        weeklyAdvancesAmount,
        schedules: empSchedules.map((s) => ({
          id: s.id,
          date: s.date.toISOString().split('T')[0],
          clockIn: s.clockIn,
          clockOut: s.clockOut,
          overtimeMinutes: s.overtimeMinutes,
          dayType: s.dayType,
          notes: s.notes,
          advances: s.advances.map((a) => ({
            id: a.id,
            amount: Number(a.amount),
            currency: a.currency,
            reason: a.reason,
            issuedAt: a.issuedAt.toISOString(),
          })),
        })),
      }
    })

    res.json({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      employees: employeesWithSchedules,
    })
  } catch (err) {
    next(err)
  }
})

// PUT /hr/calendar/week/:employeeId/:date
// Upsert de schedule + advance
router.put('/week/:employeeId/:date', async (req, res, next) => {
  try {
    const { employeeId, date: dateParam } = req.params
    const tenantId = getTenantId(res)
    
    const input = scheduleUpsertSchema.parse(req.body)
    const date = new Date(dateParam)

    // Verificar que el empleado pertenece al tenant
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, tenantId },
    })

    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado' })
    }

    // Upsert schedule
    const schedule = await prisma.employeeSchedule.upsert({
      where: {
        tenantId_employeeId_date: {
          tenantId,
          employeeId,
          date,
        },
      },
      create: {
        tenantId,
        employeeId,
        date,
        clockIn: input.clockIn ?? null,
        clockOut: input.clockOut ?? null,
        dayType: input.dayType as DayType,
        overtimeMinutes: input.overtimeMinutes,
        notes: input.notes ?? null,
      },
      update: {
        clockIn: input.clockIn ?? null,
        clockOut: input.clockOut ?? null,
        dayType: input.dayType as DayType,
        overtimeMinutes: input.overtimeMinutes,
        notes: input.notes ?? null,
      },
    })

    // Si hay advance, crear/actualizar
    if (input.advanceAmount && input.advanceAmount > 0) {
      // Buscar si ya existe un advance para este schedule
      const existingAdvance = await prisma.employeeAdvance.findFirst({
        where: {
          tenantId,
          employeeId,
          scheduleId: schedule.id,
        },
      })

      if (existingAdvance) {
        await prisma.employeeAdvance.update({
          where: { id: existingAdvance.id },
          data: {
            amount: input.advanceAmount,
          },
        })
      } else {
        await prisma.employeeAdvance.create({
          data: {
            tenantId,
            employeeId,
            scheduleId: schedule.id,
            amount: input.advanceAmount,
            currency: 'PYG',
            issuedAt: new Date(),
          },
        })
      }
    }

    res.json({ ok: true, schedule })
  } catch (err) {
    next(err)
  }
})

// GET /hr/employees
// Lista de empleados para las cards
router.get('/employees', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    
    const employees = await prisma.employee.findMany({
      where: { tenantId },
      orderBy: { firstName: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        monthlySalary: true,
        defaultShiftStart: true,
        defaultShiftEnd: true,
      },
    })

    const result = employees.map((emp) => ({
      ...emp,
      name: `${emp.firstName} ${emp.lastName}`,
      monthlySalary: emp.monthlySalary ? Number(emp.monthlySalary) : null,
    }))

    res.json(result)
  } catch (err) {
    next(err)
  }
})

export default router
