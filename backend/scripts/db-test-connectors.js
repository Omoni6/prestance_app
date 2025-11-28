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
  return {
    host: obj.PG_HOST || 'localhost',
    port: Number(obj.PG_PORT || 5432),
    user: obj.PG_USER,
    password: obj.PG_PASSWORD || '',
    database: obj.PG_DB_NAME || obj.PG_DB,
  }
}

async function main() {
  const baseDir = process.cwd()
  const envLocal = parseEnvFile(join(baseDir, '.env'))
  const cfg = cfgFrom(envLocal)
  const client = new Client(cfg)
  await client.connect()
  try {
    await client.query("INSERT INTO connectors(code, name, is_premium, created_at) VALUES('telegram','telegram', false, NOW()) ON CONFLICT (code) DO NOTHING")
    const res = await client.query('SELECT code,name FROM connectors ORDER BY code LIMIT 5')
    console.log('connectors sample:', res.rows)
  } catch (e) {
    console.log('error connectors:', e.message)
  }
  await client.end()
}

main().catch((e) => {
  console.log('error:', e.message)
  process.exit(1)
})

