/**
 * Script para crear el producto genérico "Servicio/Producto Personalizado"
 * Este producto se usa como placeholder para items personalizados en presupuestos
 * 
 * Ejecutar con: npx tsx scripts/create-generic-product.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔧 Creando producto genérico para items personalizados...')

    // Obtener todos los tenants
    const tenants = await prisma.tenant.findMany()

    if (tenants.length === 0) {
        console.log('⚠️  No se encontraron tenants en la base de datos')
        return
    }

    for (const tenant of tenants) {
        // Verificar si ya existe el producto genérico para este tenant
        const existing = await prisma.product.findFirst({
            where: {
                tenantId: tenant.id,
                sku: 'CUSTOM-ITEM-001',
            },
        })

        if (existing) {
            console.log(`✅ Producto genérico ya existe para tenant "${tenant.name}" (ID: ${tenant.id})`)
            continue
        }

        // Crear el producto genérico
        const product = await prisma.product.create({
            data: {
                tenantId: tenant.id,
                sku: 'CUSTOM-ITEM-001',
                name: 'Servicio/Producto Personalizado',
                description: 'Producto genérico para items personalizados en presupuestos. La descripción y precio se definen en cada presupuesto.',
                unit: 'UN',
                price: 0,
                cost: 0,
                taxRate: 0.1, // 10% IVA por defecto
                priceIncludesTax: false,
                stock: null, // Sin control de stock
                minStock: null,
            },
        })

        console.log(`✅ Producto genérico creado para tenant "${tenant.name}" (ID: ${tenant.id})`)
        console.log(`   Product ID: ${product.id}`)
    }

    console.log('\n✨ Proceso completado')
}

main()
    .catch((e) => {
        console.error('❌ Error:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
