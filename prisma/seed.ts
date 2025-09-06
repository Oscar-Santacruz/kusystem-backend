import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Lista de productos/servicios a insertar
// Campos del modelo Product: id, sku?, name, unit?, price (Decimal), taxRate?
// Los precios están expresados en PYG. Si manejas IVA por producto, indícame los valores y lo incorporo en taxRate.
const products: Array<{ sku: string; name: string; unit?: string; price: number; taxRate?: number | null }> = [
  { sku: 'BK002', name: 'CAMBIO DE TELA, PINTURA DE LA ESTRUCTURA Y REPARACION DE LA PARTE ELECTRICA DEL LETRERO BACKLIGHT', unit: 'UN', price: 1_300_000 },
  { sku: 'BK004', name: 'CADA BACKLIGHT UTILIZA 9 FLUORESCENTES', unit: 'UN', price: 35_000 },
  { sku: 'CE001', name: 'PINTURA DE CUADRO DE ESTACIONAMIENTO', unit: 'UN', price: 1_200_000 },
  { sku: 'CT001', name: 'PINTURA DE CENEFA DEL TINGLADO PRINCIPAL CON PINTURA P.U.', unit: 'UN', price: 105_000 },
  { sku: 'LC002', name: 'PINTURA DE LETRA CORPOREO', unit: 'UN', price: 900_000 },
  { sku: 'FO004', name: 'CADA FORRO UTILIZA 8 FLUORESCENTES', unit: 'UN', price: 32_000 },
  { sku: 'IS004', name: 'PINTURA DE ISLA DE MAQUINA', unit: 'UN', price: 1_800_000 },
  { sku: 'PF001', name: 'PINTURAS DE FILTROS GRANDE EN PU Y PLOTEADO DE LETRAS', unit: 'UN', price: 550_000 },
  { sku: 'PF002', name: 'PINTURAS DE FILTROS CHICO EN PU Y PLOTEADO DE LETRAS', unit: 'UN', price: 450_000 },
  { sku: 'PM001', name: 'PINTURA EXTERIOR DE MAQUINA TIPO HON YANG EN TINTURA P.U Y PLOTEOS DE LETRAS POR LA TAPA', unit: 'UN', price: 1_300_000 },
  { sku: 'TT005', name: 'EL TOTEM UTILIZA 30 FLUORESCENTES', unit: 'UN', price: 32_000 },
  { sku: 'LP004', name: 'CONFECCION DE CARTEL DE CHAPA MEDIDAS 1,50 x 1,00 PARA LISTA DE PRECIOS CON NUMEROS MANTADOS Y REFLECTIVOS', unit: 'UN', price: 550_000 },
]

async function main() {
  console.log('Seeding products...')

  // Asegurar tenant DEFAULT
  const tenant = await prisma.tenant.upsert({
    where: { id: 1n },
    create: { name: 'DEFAULT' },
    update: {},
  })
  const tenantId = tenant.id

  for (const p of products) {
    // Como sku no es único en el schema, hacemos un upsert manual buscando por sku primero.
    const existing = await prisma.product.findFirst({
      where: { sku: p.sku, tenantId },
    })

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          unit: p.unit,
          price: p.price, // Prisma acepta number y lo mapea a Decimal
          taxRate: p.taxRate ?? undefined,
          updatedAt: new Date(),
        },
      })
      console.log(`updated -> ${p.sku} - ${p.name}`)
    } else {
      await prisma.product.create({
        data: {
          tenantId,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          price: p.price,
          taxRate: p.taxRate ?? undefined,
        },
      })
      console.log(`created -> ${p.sku} - ${p.name}`)
    }
  }

  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
