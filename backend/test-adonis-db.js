import { Database } from '@adonisjs/lucid'
import env from '#start/env'

console.log('=== Testing Adonis Database Connection ===')
console.log('Environment variables loaded:')
console.log('PG_HOST:', env.get('PG_HOST'))
console.log('PG_PORT:', env.get('PG_PORT'))
console.log('PG_USER:', env.get('PG_USER'))
console.log('PG_PASSWORD:', env.get('PG_PASSWORD') ? '[REDACTED]' : 'undefined')
console.log('PG_DB_NAME:', env.get('PG_DB_NAME'))

try {
  const db = new Database({
    connection: 'postgres',
    connections: {
      postgres: {
        client: 'pg',
        connection: {
          host: env.get('PG_HOST'),
          port: env.get('PG_PORT'),
          user: env.get('PG_USER'),
          password: env.get('PG_PASSWORD'),
          database: env.get('PG_DB_NAME'),
        },
      },
    },
  })

  console.log('Attempting connection...')
  await db.manager.get('postgres').getReadClient()
  console.log('✅ Connection successful!')
  await db.manager.closeAll()
} catch (error) {
  console.error('❌ Connection failed:')
  console.error('Error name:', error.name)
  console.error('Error message:', error.message)
  if (error.errors) {
    console.error('Individual errors:')
    error.errors.forEach((err, i) => {
      console.error(`  ${i + 1}. ${err.message}`)
    })
  }
}
