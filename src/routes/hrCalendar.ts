import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getTenantId } from '../utils/tenant.js'
import { DayType } from '@prisma/client'
import { requirePermission } from '../middleware/permissions.js'

const router = Router()

router.use(requirePermission('hr-calendar', 'view'))

const weekInitializerSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clockIn: z.string().regex(/^\d{2}:\d{2}$/),
  clockOut: z.string().regex(/^\d{2}:\d{2}$/),
})

// Schema para validar el upsert de schedule
const scheduleUpsertSchema = z.object({
  clockIn: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  clockOut: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  dayType: z.enum(['LABORAL', 'AUSENTE', 'LIBRE', 'NO_LABORAL', 'FERIADO']),
  overtimeMinutes: z.number().int().min(0).optional().default(0),
  advanceAmount: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
})

// Schema para validar filtros de reporte
const reportFiltersSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  dayType: z.enum(['LABORAL', 'AUSENTE', 'LIBRE', 'NO_LABORAL', 'FERIADO']).optional(),
})

// GET /hr/calendar/reports
// Retorna datos filtrados para reportes
router.get('/reports', async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const filters = reportFiltersSchema.parse(req.query)
    
    const startDate = new Date(filters.startDate)
    const endDate = new Date(filters.endDate)
    endDate.setHours(23, 59, 59, 999) // Incluir todo el día final

    // Construir filtros where para empleados
    const employeeWhere: any = { tenantId }
    if (filters.employeeId) {
      employeeWhere.id = filters.employeeId
    }
    if (filters.department && filters.department !== 'all') {
      employeeWhere.department = filters.department
    }

    // Obtener empleados filtrados
    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      orderBy: { firstName: 'asc' },
    })

    // Construir filtros where para schedules
    const scheduleWhere: any = {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    }
    if (filters.dayType) {
      scheduleWhere.dayType = filters.dayType as DayType
    }
    if (filters.employeeId) {
      scheduleWhere.employeeId = filters.employeeId
    }

    // Obtener horarios filtrados
    const schedules = await prisma.employeeSchedule.findMany({
      where: scheduleWhere,
      include: {
        advances: true,
        employee: true,
      },
      orderBy: [
        { employee: { firstName: 'asc' } },
        { date: 'asc' }
      ],
    })

    // Filtrar schedules por departamento si es necesario
    const filteredSchedules = filters.department
      ? schedules.filter(s => s.employee.department === filters.department)
      : schedules

    // Agrupar schedules por empleado
    const employeesWithSchedules = employees.map((emp) => {
      const empSchedules = filteredSchedules.filter((s) => s.employeeId === emp.id)
      
      // Calcular métricas del período
      const totalOvertimeMinutes = empSchedules.reduce((sum, s) => sum + s.overtimeMinutes, 0)
      const totalAdvances = empSchedules.reduce((sum, s) => sum + s.advances.length, 0)
      const totalAdvancesAmount = empSchedules.reduce(
        (sum, s) => sum + s.advances.reduce((a: number, adv: any) => a + Number(adv.amount), 0),
        0
      )
      const attendanceCount = empSchedules.filter(s => s.clockIn && s.clockOut).length

      return {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        phone: emp.phone,
        avatarUrl: emp.avatarUrl,
        department: emp.department,
        monthlySalary: emp.monthlySalary ? Number(emp.monthlySalary) : null,
        defaultShiftStart: emp.defaultShiftStart,
        defaultShiftEnd: emp.defaultShiftEnd,
        // Métricas del período
        totalOvertimeHours: Math.round(totalOvertimeMinutes / 60 * 10) / 10,
        totalAdvances,
        totalAdvancesAmount,
        attendanceCount,
        totalDays: empSchedules.length,
        attendanceRate: empSchedules.length > 0 ? Math.round((attendanceCount / empSchedules.length) * 100 * 10) / 10 : 0,
        schedules: empSchedules.map((s) => ({
          id: s.id,
          date: s.date.toISOString().split('T')[0],
          clockIn: s.clockIn,
          clockOut: s.clockOut,
          overtimeMinutes: s.overtimeMinutes,
          dayType: s.dayType,
          notes: s.notes,
          advances: s.advances.map((a: any) => ({
            id: a.id,
            amount: Number(a.amount),
            currency: a.currency,
            reason: a.reason,
            issuedAt: a.issuedAt.toISOString(),
          })),
        })),
      }
    })

    // Calcular estadísticas generales
    const totalStats: any = {
      totalEmployees: employeesWithSchedules.length,
      totalDays: employeesWithSchedules.reduce((sum, emp) => sum + emp.totalDays, 0),
      totalAttendance: employeesWithSchedules.reduce((sum, emp) => sum + emp.attendanceCount, 0),
      totalOvertimeHours: employeesWithSchedules.reduce((sum, emp) => sum + emp.totalOvertimeHours, 0),
      totalAdvancesAmount: employeesWithSchedules.reduce((sum, emp) => sum + emp.totalAdvancesAmount, 0),
    }

    totalStats.attendanceRate = totalStats.totalDays > 0 
      ? Math.round((totalStats.totalAttendance / totalStats.totalDays) * 100 * 10) / 10 
      : 0
    totalStats.avgOvertimePerEmployee = totalStats.totalEmployees > 0 
      ? Math.round((totalStats.totalOvertimeHours / totalStats.totalEmployees) * 10) / 10 
      : 0

    res.json({
      startDate: filters.startDate,
      endDate: filters.endDate,
      filters: {
        employeeId: filters.employeeId,
        department: filters.department,
        dayType: filters.dayType,
      },
      stats: totalStats,
      employees: employeesWithSchedules,
    })
  } catch (err) {
    next(err)
  }
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

router.post('/week/initialize', requirePermission('hr-calendar', 'edit'), async (req, res, next) => {
  try {
    const tenantId = getTenantId(res)
    const { startDate, clockIn, clockOut } = weekInitializerSchema.parse(req.body)

    const [year, month, day] = startDate.split('-').map(Number)
    const start = new Date(year, month - 1, day)

    if (clockOut <= clockIn) {
      return res.status(400).json({ error: 'La hora de salida debe ser posterior a la hora de entrada' })
    }

    const employees = await prisma.employee.findMany({
      where: { tenantId },
      select: { id: true },
    })

    if (employees.length === 0) {
      return res.json({ ok: true, updatedSchedules: 0 })
    }

    const dates: Date[] = []
    for (let index = 0; index < 7; index++) {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      if (date.getDay() === 0) {
        continue
      }
      dates.push(date)
    }

    let updatedCount = 0

    for (const employee of employees) {
      for (const date of dates) {
        const schedule = await prisma.employeeSchedule.upsert({
          where: {
            tenantId_employeeId_date: {
              tenantId,
              employeeId: employee.id,
              date,
            },
          },
          create: {
            tenantId,
            employeeId: employee.id,
            date,
            clockIn,
            clockOut,
            dayType: DayType.LABORAL,
            overtimeMinutes: 0,
          },
          update: {
            clockIn,
            clockOut,
            dayType: DayType.LABORAL,
            overtimeMinutes: 0,
          },
        })

        await prisma.employeeAdvance.deleteMany({
          where: {
            tenantId,
            employeeId: employee.id,
            scheduleId: schedule.id,
          },
        })

        updatedCount++
      }
    }

    res.json({ ok: true, updatedSchedules: updatedCount })
  } catch (error) {
    next(error)
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

    // Manejar advance: crear, actualizar o eliminar
    if (input.advanceAmount !== null && input.advanceAmount !== undefined) {
      // Buscar si ya existe un advance para este schedule
      const existingAdvance = await prisma.employeeAdvance.findFirst({
        where: {
          tenantId,
          employeeId,
          scheduleId: schedule.id,
        },
      })

      if (input.advanceAmount > 0) {
        // Crear o actualizar advance con monto > 0
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
      } else {
        // Si advanceAmount es 0, eliminar el advance existente
        if (existingAdvance) {
          await prisma.employeeAdvance.delete({
            where: { id: existingAdvance.id },
          })
        }
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
