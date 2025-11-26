import { Client } from 'pg'

async function ensureLocalDb() {
  const cfg = { host: 'localhost', port: 5432, user: 'postgres', password: 'postgres', database: 'postgres' }
  console.log('Connecting to local Postgres as postgres...')
  const c = new Client(cfg)
  try {
    await c.connect()
    console.log('✅ Connected')
    await c.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='donna') THEN CREATE ROLE donna LOGIN PASSWORD 'donna'; END IF; END $$;"
    )
    console.log('✅ Role donna ensured')
    const exists = await c.query("SELECT 1 FROM pg_database WHERE datname='donna_db'")
    if (exists.rowCount === 0) {
      await c.query("CREATE DATABASE donna_db OWNER donna")
      console.log('✅ Database donna_db created')
    } else {
      console.log('✅ Database donna_db exists')
    }
  } catch (e) {
    console.error('❌ Setup error:', e.message)
    process.exit(1)
  } finally {
    await c.end()
  }
}

ensureLocalDb()
