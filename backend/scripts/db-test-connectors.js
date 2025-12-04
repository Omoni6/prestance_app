import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from 'pg'

async function main() {
  const baseDir = process.cwd()
  try {
    const c = readFileSync(join(baseDir, '.env'), 'utf-8')
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
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be defined. No fallback allowed.')
  const client = new Client({ connectionString: process.env.DATABASE_URL })
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
