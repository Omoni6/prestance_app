import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

function loadEnv(baseDir) {
  const files = ['.env', '.env.production', '.env.production.local']
  for (const f of files) {
    const p = join(baseDir, f)
    if (existsSync(p)) {
      const c = readFileSync(p, 'utf-8')
      for (const line of c.split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m) {
          const k = m[1]
          let v = m[2]
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
          process.env[k] = v
        }
      }
    }
  }
}

function cfgFromEnv() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL }
  return {
    host: process.env.PG_HOST || '127.0.0.1',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DB_NAME || process.env.PG_DB,
  }
}

async function main() {
  const baseDir = process.cwd()
  loadEnv(baseDir)
  const client = new Client(cfgFromEnv())
  await client.connect()
  const ures = await client.query("SELECT id,email FROM users WHERE LOWER(email) LIKE '%omoniprestance%' OR LOWER(email) LIKE '%omoniprestanceholding.com%' ORDER BY id LIMIT 1")
  const uid = ures.rows[0]?.id
  if (!uid) throw new Error('No target user')
  // Activate connectors
  const codes = ['google_calendar','gmail','slack','google_drive']
  for (const code of codes) {
    await client.query('INSERT INTO user_connectors(user_id,connector_code) VALUES($1,$2) ON CONFLICT DO NOTHING', [uid, code])
    await client.query('INSERT INTO user_connector_credentials(user_id,connector_code,provider,access_token,created_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT DO NOTHING', [uid, code, code.includes('google')?'google':code, 'demo-token'])
  }
  // Newsletter subscriber
  try { await client.query('INSERT INTO newsletter_subscribers(email,created_at) VALUES($1,NOW()) ON CONFLICT DO NOTHING', [ures.rows[0].email]) } catch {}
  // Deliveries test
  const proj = await client.query('SELECT id FROM projects WHERE user_id=$1 ORDER BY id LIMIT 1', [uid])
  const pid = proj.rows[0]?.id || null
  const ins = await client.query('INSERT INTO project_deliveries(project_id,type,title,url,storage_key,channels,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING id', [pid, 'document', 'Livrable de démo', 'https://api.omoniprestanceholding.com/public/sample.pdf', '', JSON.stringify(['email','slack','telegram']), 'queued'])
  const did = ins.rows[0]?.id
  await client.query('INSERT INTO outbox(type,target,payload_json,status,created_at) VALUES($1,$2,$3,$4,NOW())', ['deliver.send','document', JSON.stringify({ user_id: uid, project_id: pid, delivery_id: did, channels: ['email','slack','telegram']}), 'pending'])
  await client.query('INSERT INTO outbox(type,target,payload_json,status,created_at) VALUES($1,$2,$3,$4,NOW())', ['newsletter.send','email', JSON.stringify({ campaign_id: 1 }), 'pending'])
  console.log('seeded: connectors active, delivery queued, newsletter queued')
  await client.end()
}

main().catch((e)=>{ console.error('error:', e.message); process.exit(1) })

