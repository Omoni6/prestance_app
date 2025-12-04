import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function parseEnvFile(p) {
  try {
    const c = readFileSync(p, 'utf-8')
    const out = {}
    for (const line of c.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m) {
        const k = m[1]
        let v = m[2]
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
        out[k] = v
      }
    }
    return out
  } catch { return {} }
}

function cfgFrom(env) {
  const url = env.DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL must be defined. No fallback allowed.')
  return { connectionString: url }
}

async function ensureUserModules(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS user_modules (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NULL,
    UNIQUE(user_id, module_id)
  )`)
}

async function seedModuleConnectors(client) {
  const defaults = {
    planifi: { included: ['omoni_calendar','telegram','slack','google_calendar','google_meet','gmail'], premium: ['smtp'] },
    cree: { included: ['omoni_bucket','telegram','slack','nano_banana','sora2','gmail'], premium: ['suno','elevenlabs','google_drive'] },
    publie: { included: ['omoni_bucket','telegram','slack'], premium: ['ticketmaster','n8n','spotify'] },
    commercial: { included: ['omoni_crm','telegram','slack','omoni_calendar','hubspot','gmail','google_meet'], premium: ['salesforce','whatsapp_business','lemonsqueezy','google_calendar'] },
  }
  const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='module_connectors'")
  const cols = new Set(colRes.rows.map((r) => r.column_name))
  const hasIncluded = cols.has('included')
  const hasType = cols.has('type')
  const consRes = await client.query('SELECT LOWER(code) AS code FROM connectors')
  const cons = new Set(consRes.rows.map((r) => String(r.code)))
  for (const [mk, lists] of Object.entries(defaults)) {
    for (const code of lists.included) {
      if (!cons.has(String(code).toLowerCase())) continue
      if (hasIncluded) {
        await client.query(
          'INSERT INTO module_connectors (module_key, connector_code, included, type, created_at) SELECT $1, $2, TRUE, NULL, NOW() WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = $1 AND connector_code = $2)',
          [mk, code]
        )
      } else if (hasType) {
        await client.query(
          'INSERT INTO module_connectors (module_key, connector_code, type, created_at) SELECT $1, $2, NULL, NOW() WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = $1 AND connector_code = $2)',
          [mk, code]
        )
      } else {
        await client.query(
          'INSERT INTO module_connectors (module_key, connector_code) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = $1 AND connector_code = $2)',
          [mk, code]
        )
      }
    }
    for (const code of lists.premium) {
      if (!cons.has(String(code).toLowerCase())) continue
      if (hasIncluded) {
        await client.query(
          'INSERT INTO module_connectors (module_key, connector_code, included, type, created_at) SELECT $1, $2, FALSE, $3, NOW() WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = $1 AND connector_code = $2)',
          [mk, code, 'premium']
        )
      } else if (hasType) {
        await client.query(
          'INSERT INTO module_connectors (module_key, connector_code, type, created_at) SELECT $1, $2, $3, NOW() WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = $1 AND connector_code = $2)',
          [mk, code, 'premium']
        )
      } else {
        await client.query(
          'INSERT INTO module_connectors (module_key, connector_code) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM module_connectors WHERE module_key = $1 AND connector_code = $2)',
          [mk, code]
        )
      }
    }
  }
}

async function main() {
  const base = process.cwd()
  const envVars = parseEnvFile(join(base, '.env'))
  const cfg = cfgFrom(envVars)
  const client = new Client(cfg)
  await client.connect()
  await ensureUserModules(client)
  await seedModuleConnectors(client)
  const res = await client.query("SELECT module_key, COUNT(*) AS link_count FROM module_connectors GROUP BY module_key ORDER BY module_key")
  console.log('module_connectors counts:', res.rows)
  await client.end()
}

main().catch((e) => { console.log('Erreur:', e.message); process.exit(1) })
