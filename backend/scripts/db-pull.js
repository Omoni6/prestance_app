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

function cfg(obj) {
  return {
    host: obj.PG_HOST,
    port: obj.PG_PORT || '5432',
    user: obj.PG_USER,
    password: obj.PG_PASSWORD,
    db: obj.PG_DB_NAME || obj.PG_DB,
  }
}

function run(cmd, args, env) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: 'inherit' })
    p.on('exit', (code) => resolve(code))
  })
}

async function main() {
  const base = new URL('../', import.meta.url)
  const envLocal = parseEnvFile(join(base.pathname, '.env'))
  const envProd = parseEnvFile(join(base.pathname, '.env.production'))
  const local = cfg(envLocal)
  const vps = cfg(envProd)
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
  console.log('⏳ Restauration locale…')
  const restoreCode = await run('pg_restore', ['-h', local.host || 'localhost', '-p', local.port || '5432', '-U', local.user, '-d', local.db, '--clean', '--if-exists', dumpPath], {
    PGPASSWORD: local.password,
  })
  if (restoreCode !== 0) {
    console.log('❌ Erreur pg_restore (local). Assurez-vous que pg_restore est installé et accessible.')
    process.exit(1)
  }
  console.log('✔ Restauration locale OK')
}

main().catch((e) => {
  console.log('❌ Erreur:', e.message)
  process.exit(1)
})
