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

const quoteIdent = (name) => `"${String(name).replaceAll('"', '""')}"`

async function getTables(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)

  return rows.map((row) => row.table_name)
}

async function getColumns(client, table) {
  const { rows } = await client.query(
    `
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  )

  return rows
}

async function getPrimaryKey(client, table) {
  const { rows } = await client.query(
    `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `,
    [table]
  )

  return rows.map((row) => row.column_name)
}

async function getCount(client, table) {
  const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${quoteIdent(table)}`)
  return rows[0].count
}

async function getMissingPkCount(source, target, table, pkColumn) {
  const sourceTable = quoteIdent(table)
  const targetTable = quoteIdent(table)
  const pk = quoteIdent(pkColumn)

  const sourceRows = await source.query(`SELECT ${pk} FROM ${sourceTable}`)
  if (sourceRows.rows.length === 0) {
    return 0
  }

  const ids = sourceRows.rows.map((row) => row[pkColumn])
  const targetRows = await target.query(
    `SELECT ${pk} FROM ${targetTable} WHERE ${pk} = ANY($1)`,
    [ids]
  )
  const targetIds = new Set(targetRows.rows.map((row) => String(row[pkColumn])))

  return ids.filter((id) => !targetIds.has(String(id))).length
}

function columnSignature(column) {
  return [
    column.data_type,
    column.udt_name,
    column.is_nullable,
    column.column_default ?? '',
  ].join('|')
}

function compareColumns(neonColumns, supabaseColumns) {
  const neonMap = new Map(neonColumns.map((column) => [column.column_name, column]))
  const supabaseMap = new Map(supabaseColumns.map((column) => [column.column_name, column]))
  const names = new Set([...neonMap.keys(), ...supabaseMap.keys()])
  const missingInSupabase = []
  const missingInNeon = []
  const changed = []

  for (const name of [...names].sort()) {
    const neonColumn = neonMap.get(name)
    const supabaseColumn = supabaseMap.get(name)

    if (!supabaseColumn) {
      missingInSupabase.push(name)
      continue
    }

    if (!neonColumn) {
      missingInNeon.push(name)
      continue
    }

    if (columnSignature(neonColumn) !== columnSignature(supabaseColumn)) {
      changed.push(name)
    }
  }

  return { missingInSupabase, missingInNeon, changed }
}

function printSection(title) {
  console.log(`\n## ${title}`)
}

function printTable(rows) {
  if (rows.length === 0) {
    console.log('Sin diferencias.')
    return
  }

  const headers = Object.keys(rows[0])
  console.log(`| ${headers.join(' |')} |`)
  console.log(`| ${headers.map(() => '---').join(' |')} |`)
  for (const row of rows) {
    console.log(`| ${headers.map((header) => String(row[header] ?? '')).join(' |')} |`)
  }
}

async function main() {
  const neon = new Client({ connectionString: NEON_URL })
  const supabase = new Client({ connectionString: SUPABASE_URL })

  await neon.connect()
  await supabase.connect()

  try {
    const [neonTables, supabaseTables] = await Promise.all([
      getTables(neon),
      getTables(supabase),
    ])

    const allTables = [...new Set([...neonTables, ...supabaseTables])].sort()
    const tableRows = []
    const columnRows = []
    const pkRows = []

    for (const table of allTables) {
      const existsInNeon = neonTables.includes(table)
      const existsInSupabase = supabaseTables.includes(table)

      const neonCount = existsInNeon ? await getCount(neon, table) : null
      const supabaseCount = existsInSupabase ? await getCount(supabase, table) : null

      tableRows.push({
        tabla: table,
        neon: existsInNeon ? neonCount : 'NO EXISTE',
        supabase: existsInSupabase ? supabaseCount : 'NO EXISTE',
        diferencia: existsInNeon && existsInSupabase ? supabaseCount - neonCount : '',
      })

      if (!existsInNeon || !existsInSupabase) {
        continue
      }

      const [neonColumns, supabaseColumns, neonPk, supabasePk] = await Promise.all([
        getColumns(neon, table),
        getColumns(supabase, table),
        getPrimaryKey(neon, table),
        getPrimaryKey(supabase, table),
      ])
      const columnDiff = compareColumns(neonColumns, supabaseColumns)

      if (
        columnDiff.missingInSupabase.length > 0 ||
        columnDiff.missingInNeon.length > 0 ||
        columnDiff.changed.length > 0
      ) {
        columnRows.push({
          tabla: table,
          faltan_en_supabase: columnDiff.missingInSupabase.join(', '),
          sobran_en_supabase: columnDiff.missingInNeon.join(', '),
          columnas_distintas: columnDiff.changed.join(', '),
        })
      }

      if (neonPk.length === 1 && supabasePk.length === 1 && neonPk[0] === supabasePk[0]) {
        const pkColumn = neonPk[0]
        const [missingInSupabase, extraInSupabase] = await Promise.all([
          getMissingPkCount(neon, supabase, table, pkColumn),
          getMissingPkCount(supabase, neon, table, pkColumn),
        ])

        if (missingInSupabase > 0 || extraInSupabase > 0) {
          pkRows.push({
            tabla: table,
            pk: pkColumn,
            faltan_en_supabase: missingInSupabase,
            extra_en_supabase: extraInSupabase,
          })
        }
      }
    }

    printSection('Conteo de registros')
    printTable(tableRows)

    printSection('Diferencias de columnas')
    printTable(columnRows)

    printSection('Diferencias por llave primaria')
    printTable(pkRows)
  } finally {
    await neon.end()
    await supabase.end()
  }
}

main().catch((error) => {
  console.error(`[error] ${error.message}`)
  process.exit(1)
})
