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
  const dumpPath = join(base.pathname, 'tmp', 'local_dump.dump')
  console.log('⏳ Dump local en cours…')
  const dumpCode = await run('pg_dump', ['-h', local.host || 'localhost', '-p', local.port || '5432', '-U', local.user, '-d', local.db, '-Fc', '-f', dumpPath], {
    PGPASSWORD: local.password,
  })
  if (dumpCode !== 0) {
    console.log('❌ Erreur pg_dump (local). Assurez-vous que pg_dump est installé et accessible.')
    process.exit(1)
  }
  console.log('📤 Push vers VPS…')
  const restoreCode = await run('pg_restore', ['-h', vps.host, '-p', vps.port || '5432', '-U', vps.user, '-d', vps.db, '--clean', '--if-exists', dumpPath], {
    PGPASSWORD: vps.password,
  })
  if (restoreCode !== 0) {
    console.log('❌ Erreur pg_restore (VPS). Assurez-vous que pg_restore est installé et accessible.')
    process.exit(1)
  }
  console.log('✔ Push terminé')
}

main().catch((e) => {
  console.log('❌ Erreur:', e.message)
  process.exit(1)
})
