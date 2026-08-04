import pg from 'pg'
import dotenv from 'dotenv'
const { Client } = pg

dotenv.config()

const NEON_URL = process.env.NEON_DATABASE_URL
const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL ?? process.env.DIRECT_URL

if (!NEON_URL) {
  throw new Error('NEON_DATABASE_URL requerido')
}

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_DATABASE_URL o DIRECT_URL requerido')
}

// Orden respetando foreign keys
const TABLES = [
  'User',
  'Tenant',
  'Membership',
  'Invitation',
  'Permission',
  'RolePermission',
  'Client',
  'ClientBranch',
  'ProductTemplate',
  'Product',
  'Quote',
  'QuoteItem',
  'QuoteAdditionalCharge',
  'QuoteStatusHistory',
  'Employee',
  'EmployeeSalaryHistory',
  'EmployeePayment',
  'EmployeeSchedule',
  'EmployeeAdvance',
]

async function migrate() {
  const src = new Client({ connectionString: NEON_URL })
  const dst = new Client({ connectionString: SUPABASE_URL })

  await src.connect()
  console.log('✓ Conectado a Neon')
  await dst.connect()
  console.log('✓ Conectado a Supabase')

  for (const table of TABLES) {
    const { rows } = await src.query(`SELECT * FROM "${table}"`)
    if (rows.length === 0) {
      console.log(`  — ${table}: vacía, saltando`)
      continue
    }

    // Obtener columnas que existen en Supabase para esta tabla
    const { rows: dstCols } = await dst.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
      [table]
    )
    const validCols = new Set(dstCols.map(r => r.column_name))

    // Filtrar columnas de Neon que no existen en Supabase
    const srcCols = Object.keys(rows[0])
    const filteredCols = srcCols.filter(c => validCols.has(c))
    const skippedCols = srcCols.filter(c => !validCols.has(c))
    if (skippedCols.length > 0) {
      console.log(`  ℹ ${table}: columnas ignoradas (no existen en Supabase): ${skippedCols.join(', ')}`)
    }

    const colsSql = filteredCols.map(c => `"${c}"`).join(', ')
    let inserted = 0
    let skipped = 0

    for (const row of rows) {
      const vals = filteredCols.map(c => row[c])
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')
      try {
        await dst.query(
          `INSERT INTO "${table}" (${colsSql}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          vals
        )
        inserted++
      } catch (err) {
        console.warn(`  ⚠ Fila omitida en ${table}:`, err.message)
        skipped++
      }
    }
    console.log(`  ✓ ${table}: ${inserted} filas insertadas, ${skipped} omitidas`)
  }

  // Sincronizar secuencia de quote_number_seq
  try {
    const { rows } = await src.query(`SELECT last_value FROM quote_number_seq`)
    if (rows[0]?.last_value) {
      await dst.query(`SELECT setval('quote_number_seq', $1)`, [rows[0].last_value])
      console.log(`  ✓ Secuencia quote_number_seq sincronizada: ${rows[0].last_value}`)
    }
  } catch {
    console.log('  — Secuencia quote_number_seq no encontrada, saltando')
  }

  await src.end()
  await dst.end()
  console.log('\n✅ Migración completada')
}

migrate().catch(err => {
  console.error('❌ Error en migración:', err.message)
  process.exit(1)
})
