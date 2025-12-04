import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const url = env.get('DATABASE_URL')
if (!url) {
  throw new Error('DATABASE_URL must be defined. No fallback allowed.')
}

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: { connectionString: url },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: false,
    },
  },
})

export default dbConfig
