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
  const ver = await client.query('SHOW server_version')
  const dbn = await client.query('SELECT current_database() AS db')
  console.log('server_version:', ver.rows[0].server_version, 'db:', dbn.rows[0].db)
  const ures = await client.query("SELECT id,email FROM users WHERE LOWER(email) LIKE '%omoniprestance%' OR LOWER(email) LIKE '%omoniprestanceholding.com%' ORDER BY id LIMIT 1")
  let uid = ures.rows[0]?.id
  console.log('target_user:', uid, ures.rows[0]?.email)
  if (!uid) {
    const u2 = await client.query('SELECT id,email FROM users ORDER BY id LIMIT 1')
    uid = u2.rows[0]?.id
    console.log('fallback_user:', uid, u2.rows[0]?.email)
  }
  if (!uid) throw new Error('No user found')
  const p1 = await client.query('INSERT INTO projects(user_id,name,description,archived,created_at) VALUES($1,$2,$3,false,NOW()) RETURNING id', [uid, 'Projet Test A', 'Projet de test A'])
  const p2 = await client.query('INSERT INTO projects(user_id,name,description,archived,created_at) VALUES($1,$2,$3,false,NOW()) RETURNING id', [uid, 'Projet Test B', 'Projet de test B'])
  console.log('projects_created:', p1.rows[0].id, p2.rows[0].id)
  await client.query('INSERT INTO tasks(user_id,project_id,title,status,created_at) VALUES($1,$2,$3,$4,NOW())', [uid, p1.rows[0].id, 'Tâche de test', 'todo'])
  const tc = await client.query('SELECT COUNT(*) AS c FROM tasks WHERE user_id=$1', [uid])
  console.log('tasks_count_for_user:', Number(tc.rows[0].c))
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })

