import { Client } from 'pg'

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(`CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL
  )`)
  await client.query(`CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'todo',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL
  )`)
  const p = await client.query('SELECT COUNT(*) AS c FROM projects')
  const t = await client.query("SELECT COUNT(*) AS c FROM tasks WHERE status='done'")
  console.log('projects:', Number(p.rows[0].c), 'tasks_done:', Number(t.rows[0].c))
  await client.end()
}

main().catch((e) => {
  console.log('error:', e.message)
  process.exit(1)
})

