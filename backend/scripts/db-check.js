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
  const get = (k) => (obj[k] ?? process.env[k])
  return {
    host: get('PG_HOST') || 'localhost',
    port: Number(get('PG_PORT') || 5432),
    user: get('PG_USER'),
    password: typeof get('PG_PASSWORD') === 'string' ? get('PG_PASSWORD') : String(get('PG_PASSWORD') ?? ''),
    database: get('PG_DB_NAME') || get('PG_DB'),
  }
}

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
  const pathLocal = join(baseDir, '.env')
  const pathProd = join(baseDir, '.env.production')
  console.log('Paths:', { local: pathLocal, prod: pathProd })
  const envLocal = parseEnvFile(pathLocal)
  const envProd = parseEnvFile(pathProd)
  const cfgLocal = cfgFrom(envLocal)
  const cfgRemote = cfgFrom(envProd)
  console.log('⏳ Vérification schéma local vs VPS...')
  console.log('Local cfg:', { host: cfgLocal.host, port: cfgLocal.port, user: cfgLocal.user, password_type: typeof cfgLocal.password, database: cfgLocal.database })
  let lc, rc
  try {
    lc = new Client(cfgLocal)
    await lc.connect()
  } catch (e) {
    console.log('❌ Connexion locale échouée:', e.message)
    process.exit(1)
  }
  try {
    rc = new Client(cfgRemote)
    await rc.connect()
  } catch (e) {
    console.log('❌ Erreur connexion VPS:', e.message)
    await lc.end()
    process.exit(1)
  }
  try {
    const lschema = await fetchSchema(lc)
    const rschema = await fetchSchema(rc)
    const diff = diffSchemas(lschema, rschema)
    if (!diff.tablesOnlyLocal.length && !diff.tablesOnlyRemote.length && !diff.colDiffs.length && !diff.pkDiffs.length) {
      console.log('✔ Migration sync OK')
    } else {
      console.log('⚠ Différences détectées')
      if (diff.tablesOnlyLocal.length) console.log('Tables uniquement local:', diff.tablesOnlyLocal.join(', '))
      if (diff.tablesOnlyRemote.length) console.log('Tables uniquement VPS:', diff.tablesOnlyRemote.join(', '))
      for (const d of diff.colDiffs) {
        console.log(`Table ${d.table}`)
        if (d.added.length) console.log('  Colonnes ajoutées (VPS):', d.added.join(', '))
        if (d.removed.length) console.log('  Colonnes manquantes (VPS):', d.removed.join(', '))
        for (const c of d.changed) console.log(`  Changement ${c.name}: local(${c.local.type}, nullable=${c.local.nullable}) vs vps(${c.remote.type}, nullable=${c.remote.nullable})`)
      }
      for (const p of diff.pkDiffs) console.log(`PK ${p.table}: local(${p.local.join(',')}) vs vps(${p.remote.join(',')})`)
    }
  } finally {
    await lc.end()
    await rc.end()
  }
}

main().catch((e) => {
  console.log('❌ Erreur:', e.message)
  process.exit(1)
})
