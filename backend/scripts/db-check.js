import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

async function fetchSchema(client) {
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name"
  )
  const tnames = tables.rows.map((r) => r.table_name)
  const columns = {}
  const pks = {}
  for (const t of tnames) {
    const cols = await client.query(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
      [t]
    )
    columns[t] = cols.rows.map((r) => ({ name: r.column_name, type: r.data_type, nullable: r.is_nullable === 'YES' }))
    const pk = await client.query(
      "SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema WHERE tc.table_schema='public' AND tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY' ORDER BY kcu.ordinal_position",
      [t]
    )
    pks[t] = pk.rows.map((r) => r.column_name)
  }
  return { tables: tnames, columns, pks }
}

function diffSchemas(local, remote) {
  const out = { tablesOnlyLocal: [], tablesOnlyRemote: [], colDiffs: [], pkDiffs: [] }
  const lset = new Set(local.tables)
  const rset = new Set(remote.tables)
  for (const t of lset) if (!rset.has(t)) out.tablesOnlyLocal.push(t)
  for (const t of rset) if (!lset.has(t)) out.tablesOnlyRemote.push(t)
  for (const t of local.tables) {
    if (!rset.has(t)) continue
    const lcols = local.columns[t]
    const rcols = remote.columns[t]
    const lmap = new Map(lcols.map((c) => [c.name, c]))
    const rmap = new Map(rcols.map((c) => [c.name, c]))
    const added = []
    const removed = []
    const changed = []
    for (const [name, c] of lmap) {
      if (!rmap.has(name)) removed.push(name)
      else {
        const rc = rmap.get(name)
        if (c.type !== rc.type || c.nullable !== rc.nullable) changed.push({ name, local: c, remote: rc })
      }
    }
    for (const [name] of rmap) if (!lmap.has(name)) added.push(name)
    if (added.length || removed.length || changed.length) out.colDiffs.push({ table: t, added, removed, changed })
    const lpk = local.pks[t].join(',')
    const rpk = remote.pks[t].join(',')
    if (lpk !== rpk) out.pkDiffs.push({ table: t, local: local.pks[t], remote: remote.pks[t] })
  }
  return out
}

async function main() {
  const baseDir = process.cwd()
  const envPath = join(baseDir, '.env')
  try {
    const c = readFileSync(envPath, 'utf-8')
    for (const line of c.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) {
        const k = m[1]
        let v = m[2]
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        if (!process.env[k]) process.env[k] = v
      }
    }
  } catch {}
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must be defined. No fallback allowed.')
  const client = new Client({ connectionString: url })
  await client.connect()
  const schema = await fetchSchema(client)
  console.log('✔ Schéma (VPS) tables:', schema.tables)
  await client.end()
}

main().catch((e) => {
  console.log('❌ Erreur:', e.message)
  process.exit(1)
})
