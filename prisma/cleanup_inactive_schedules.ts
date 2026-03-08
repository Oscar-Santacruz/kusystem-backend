import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
    const startDate = new Date('2026-03-02')
    const endDate = new Date('2026-03-08')

    console.log('Cleaning up schedules for inactive employees...')
    console.log('Date range:', startDate.toISOString(), 'to', endDate.toISOString())

    // Find inactive employees
    const inactiveEmployees = await prisma.employee.findMany({
        where: { isActive: false },
        select: { id: true, firstName: true, lastName: true }
    })

    if (inactiveEmployees.length === 0) {
        console.log('No inactive employees found.')
        return
    }

    const inactiveIds = inactiveEmployees.map(e => e.id)
    const names = inactiveEmployees.map(e => `${e.firstName} ${e.lastName}`).join(', ')

    console.log(`Found ${inactiveIds.length} inactive employees: ${names}`)

    // Delete schedules for these employees in the date range
    const deleted = await prisma.employeeSchedule.deleteMany({
        where: {
            employeeId: { in: inactiveIds },
            date: {
                gte: startDate,
                lte: endDate
            }
        }
    })

    console.log(`Deleted ${deleted.count} schedule records for inactive employees between 2026-03-02 and 2026-03-08.`)
}

main()
    .catch(e => {
        console.error('Error during cleanup:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
