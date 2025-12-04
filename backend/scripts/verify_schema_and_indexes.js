import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function parseEnvFile(p) {
  try {
    const c = readFileSync(p, 'utf-8')
    const out = {}
    c.split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#'))
      .forEach((line) => {
        const i = line.indexOf('=')
        if (i > 0) {
          const k = line.slice(0, i).trim()
          let v = line.slice(i + 1).trim()
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
          out[k] = v
        }
      })
    return out
  } catch {
    return {}
  }
}

function cfgFrom(obj) {
  if (obj.DATABASE_URL) return { connectionString: obj.DATABASE_URL }
  throw new Error('DATABASE_URL must be defined. No fallback allowed.')
}

async function existsTable(client, tname) {
  const res = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [tname])
  return res.rowCount > 0
}

async function getColumns(client, tname) {
  const res = await client.query(
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
    [tname]
  )
  const out = new Map()
  for (const r of res.rows) out.set(r.column_name, { type: r.data_type, nullable: r.is_nullable === 'YES' })
  return out
}

async function ensureColumn(client, tname, column, definitionSql) {
  const cols = await getColumns(client, tname)
  if (!cols.has(column)) {
    await client.query(`ALTER TABLE ${tname} ADD COLUMN ${definitionSql}`)
    return true
  }
  return false
}

async function ensureUniqueIndex(client, indexName, tname, columns) {
  const res = await client.query('SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2', ['public', indexName])
  if (res.rowCount === 0) {
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${indexName} ON ${tname} (${columns})`)
    return true
  }
  return false
}

async function checkOrphans(client) {
  const out = {}
  const uc = await client.query(
    'SELECT COUNT(*)::int AS c FROM user_connectors uc LEFT JOIN users u ON u.id = uc.user_id WHERE u.id IS NULL'
  )
  out.user_connectors_missing_users = uc.rows[0]?.c ?? 0
  const ucc = await client.query(
    'SELECT COUNT(*)::int AS c FROM user_connectors uc LEFT JOIN connectors c ON c.code = uc.connector_code WHERE c.code IS NULL'
  )
  out.user_connectors_missing_connectors = ucc.rows[0]?.c ?? 0
  // module_key vs modules.slug if present
  const hasSlug = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='modules' AND column_name='slug'"
  )
  if (hasSlug.rowCount > 0) {
    const mc = await client.query(
      'SELECT COUNT(*)::int AS c FROM module_connectors mc LEFT JOIN modules m ON m.slug = mc.module_key WHERE m.slug IS NULL'
    )
    out.module_connectors_missing_modules = mc.rows[0]?.c ?? 0
  } else {
    out.module_connectors_missing_modules = null
  }
  return out
}

async function main() {
  const baseDir = process.cwd()
  const envLocal = parseEnvFile(join(baseDir, '.env'))
  const cfg = cfgFrom(envLocal)
  const client = new Client(cfg)
  await client.connect()

  const requiredTables = ['users','modules','connectors','module_connectors','user_modules','user_connectors']
  const tablesStatus = {}
  for (const t of requiredTables) tablesStatus[t] = await existsTable(client, t)

  const added = { columns: [], indexes: [] }
  if (tablesStatus.connectors) {
    const colsAdded = []
    if (await ensureColumn(client, 'connectors', 'icon', 'icon VARCHAR(256) NULL')) colsAdded.push('icon')
    if (await ensureColumn(client, 'connectors', 'price', 'price NUMERIC(10,2) NOT NULL DEFAULT 0')) colsAdded.push('price')
    added.columns.push({ table: 'connectors', columns: colsAdded })
  }

  // Indexes
  if (tablesStatus.module_connectors) {
    if (await ensureUniqueIndex(client, 'idx_module_connectors_unique', 'module_connectors', 'module_key, connector_code')) {
      added.indexes.push('idx_module_connectors_unique')
    }
  }
  if (tablesStatus.user_connectors) {
    if (await ensureUniqueIndex(client, 'idx_user_connectors_unique', 'user_connectors', 'user_id, connector_code')) {
      added.indexes.push('idx_user_connectors_unique')
    }
  }

  const orphans = await checkOrphans(client)

  // Connectors listing
  let connectors = []
  if (tablesStatus.connectors) {
    const res = await client.query('SELECT code, name, icon, is_premium, price FROM connectors ORDER BY code')
    connectors = res.rows
  }

  console.log('Tables présentes:', tablesStatus)
  console.log('Ajouts effectués:', added)
  console.log('FK orphelines:', orphans)
  console.log('Connectors count:', connectors.length)
  if (connectors.length) console.log('Exemples:', connectors.slice(0, Math.min(5, connectors.length)))

  await client.end()
}

main().catch((e) => {
  console.log('Erreur:', e.message)
  process.exit(1)
})
