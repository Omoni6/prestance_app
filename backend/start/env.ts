/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function loadEnvFile(rel: string) {
  try {
    const base = new URL('../', import.meta.url)
    const p = join(base.pathname, rel)
    const content = readFileSync(p, 'utf-8')
    content
      .split(/\r?\n/)
      .filter((l) => l && !l.trim().startsWith('#'))
      .forEach((line) => {
        const idx = line.indexOf('=')
        if (idx > 0) {
          const k = line.slice(0, idx).trim()
          let v = line.slice(idx + 1).trim()
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1)
          }
          if (!process.env[k]) process.env[k] = v
        }
      })
  } catch {}
}

loadEnvFile('.env')

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DATABASE_URL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for Google OAuth
  |----------------------------------------------------------
  */
  GOOGLE_CLIENT_ID: Env.schema.string(),
  GOOGLE_CLIENT_SECRET: Env.schema.string(),
  GOOGLE_REDIRECT_URI: Env.schema.string(),
  FRONTEND_URL: Env.schema.string(),
})
