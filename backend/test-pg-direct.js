import { Client } from 'pg'

const client = new Client({
  host: '92.113.29.38',
  port: 5432,
  user: 'donna',
  password: 'donna',
  database: 'donna_db',
})

async function testConnection() {
  try {
    await client.connect()
    console.log('✅ Connected to PostgreSQL successfully!')

    const result = await client.query('SELECT current_database(), current_user')
    console.log('Database:', result.rows[0].current_database)
    console.log('User:', result.rows[0].current_user)

    await client.end()
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

testConnection()
