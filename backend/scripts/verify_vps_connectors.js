import { Client } from 'pg'

async function main() {
  const url = 'postgres://donna:donna@92.113.29.38:5432/donna_db'
  const client = new Client({ connectionString: url })
  await client.connect()
  const res = await client.query('SELECT code, name FROM connectors ORDER BY code')
  console.log('DB:', url)
  console.log('count:', res.rowCount)
  console.log('first:', res.rows.slice(0, 10))
  await client.end()
}

main().catch((e) => { console.error('error:', e.message); process.exit(1) })

