import pg from 'pg'
import dotenv from 'dotenv'

const { Client } = pg

dotenv.config()

const NEON_URL = process.env.NEON_DATABASE_URL
const SUPABASE_URL = process.env.SUPABASE_DATABASE_URL ?? process.env.DIRECT_URL
const TABLES = ['Product', 'Quote', 'QuoteItem']

if (!NEON_URL) {
  throw new Error('NEON_DATABASE_URL requerido')
}

if (!SUPABASE_URL) {
  throw new Error('SUPABASE_DATABASE_URL o DIRECT_URL requerido')
}

const quoteIdent = (name) => `"${String(name).replaceAll('"', '""')}"`

async function getColumns(client, table) {
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  )

  return rows.map((row) => row.column_name)
}

async function getMissingIds(source, target, table) {
  const tableSql = quoteIdent(table)
  const { rows: sourceRows } = await source.query(`SELECT "id" FROM ${tableSql}`)
  const sourceIds = sourceRows.map((row) => row.id)

  if (sourceIds.length === 0) {
    return []
  }

  const { rows: targetRows } = await target.query(
    `SELECT "id" FROM ${tableSql} WHERE "id" = ANY($1)`,
    [sourceIds]
  )
  const targetIds = new Set(targetRows.map((row) => String(row.id)))

  return sourceIds.filter((id) => !targetIds.has(String(id)))
}

async function insertRows(source, target, table, ids) {
  if (ids.length === 0) {
    return 0
  }

  const tableSql = quoteIdent(table)
  const [sourceColumns, targetColumns] = await Promise.all([
    getColumns(source, table),
    getColumns(target, table),
  ])
  const targetColumnSet = new Set(targetColumns)
  const columns = sourceColumns.filter((column) => targetColumnSet.has(column))

  const { rows } = await source.query(
    `SELECT ${columns.map(quoteIdent).join(', ')} FROM ${tableSql} WHERE "id" = ANY($1)`,
    [ids]
  )

  let inserted = 0
  const columnSql = columns.map(quoteIdent).join(', ')
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')

  for (const row of rows) {
    const values = columns.map((column) => row[column])
    const result = await target.query(
      `INSERT INTO ${tableSql} (${columnSql}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values
    )
    inserted += result.rowCount
  }

  return inserted
}

async function main() {
  const neon = new Client({ connectionString: NEON_URL })
  const supabase = new Client({ connectionString: SUPABASE_URL })

  await neon.connect()
  await supabase.connect()

  try {
    for (const table of TABLES) {
      const missingIds = await getMissingIds(neon, supabase, table)
      const inserted = await insertRows(neon, supabase, table, missingIds)
      console.log(`${table}: faltaban ${missingIds.length}, insertados ${inserted}`)
    }
  } finally {
    await neon.end()
    await supabase.end()
  }
}

main().catch((error) => {
  console.error(`[error] ${error.message}`)
  process.exit(1)
})
