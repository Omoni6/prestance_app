import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

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

function parseDatabaseUrl(url) {
  const m = url.match(/^postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^\s]+)$/)
  if (!m) throw new Error('Invalid DATABASE_URL format')
  return { user: m[1], password: m[2], host: m[3], port: m[4], db: m[5] }
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: 'inherit' })
    p.on('exit', (code) => resolve(code))
  })
}

async function main() {
  const base = new URL('../', import.meta.url)
  const envVars = parseEnvFile(join(base.pathname, '.env'))
  if (!envVars.DATABASE_URL) throw new Error('DATABASE_URL must be defined. No fallback allowed.')
  const vps = parseDatabaseUrl(envVars.DATABASE_URL)
  if (!existsSync(join(base.pathname, 'tmp'))) mkdirSync(join(base.pathname, 'tmp'))
  const dumpPath = join(base.pathname, 'tmp', 'vps_dump.dump')
  console.log('⏳ Dump en cours…')
  const dumpCode = await run('pg_dump', ['-h', vps.host, '-p', vps.port, '-U', vps.user, '-d', vps.db, '-Fc', '-f', dumpPath], {
    PGPASSWORD: vps.password,
  })
  if (dumpCode !== 0) {
    console.log('❌ Erreur pg_dump (VPS). Assurez-vous que pg_dump est installé et accessible.')
    process.exit(1)
  }
  console.log('📥 Pull terminé')
  console.log('✔ Dump VPS OK (aucune restauration locale)')
}

main().catch((e) => {
  console.log('❌ Erreur:', e.message)
  process.exit(1)
})
